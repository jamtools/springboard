import {BehaviorSubject, Subject, Subscription} from 'rxjs';
import {
    MacroWorkflowConfig,
    WorkflowInstance,
    WorkflowTemplateType,
    WorkflowTemplateConfigs,
    WorkflowTemplate,
    ValidationResult,
    FlowTestResult,
    DynamicMacroAPI,
    MacroTypeDefinition,
    LegacyMacroInfo,
    MigrationResult,
    WorkflowEvent,
    WorkflowEventEmitter,
    ConnectionHandle,
    WorkflowMetrics
} from './dynamic_macro_types';
import {MacroAPI, macroTypeRegistry} from './registered_macro_types';
import {MacroTypeConfigs} from './macro_module_types';
// Import all macro handlers to ensure they are registered
import './macro_handlers';
import {ReactiveConnectionManager} from './reactive_connection_system';
import {WorkflowValidator} from './workflow_validation';
import {deviceConfigManager, LogicalTemplateConfig} from './device_configuration_manager';

/**
 * Core manager for dynamic macro workflows.
 * Handles workflow lifecycle, instance management, and hot reloading.
 */
export class DynamicMacroManager implements DynamicMacroAPI, WorkflowEventEmitter {
    private workflows = new Map<string, MacroWorkflowConfig>();
    private instances = new Map<string, WorkflowInstance>();
    private macroTypeDefinitions = new Map<keyof MacroTypeConfigs, MacroTypeDefinition>();
    private templates = new Map<WorkflowTemplateType, WorkflowTemplate<any>>();
    private eventHandlers = new Map<WorkflowEvent['type'], Array<(event: WorkflowEvent) => void>>();
  
    private connectionManager: ReactiveConnectionManager;
    private validator: WorkflowValidator;
  
    // Performance monitoring
    private metricsUpdateInterval: NodeJS.Timeout | null = null;
    private readonly METRICS_UPDATE_INTERVAL_MS = 1000;
  
    constructor(
        private macroAPI: MacroAPI,
        private persistenceKey: string = 'dynamic_workflows'
    ) {
        this.connectionManager = new ReactiveConnectionManager();
        this.validator = new WorkflowValidator();
    
        // Initialize built-in templates
        this.initializeTemplates();
    
        // Start performance monitoring
        this.startMetricsMonitoring();
    }

    // =============================================================================
    // WORKFLOW MANAGEMENT
    // =============================================================================

    async createWorkflow(config: MacroWorkflowConfig): Promise<string> {
    // Validate configuration
        const validation = await this.validateWorkflow(config);
        if (!validation.valid) {
            throw new Error(`Workflow validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }

        // Ensure unique ID
        if (this.workflows.has(config.id)) {
            throw new Error(`Workflow with ID ${config.id} already exists`);
        }

        // Store configuration
        this.workflows.set(config.id, {...config});
    
        // Create and initialize instance if enabled
        if (config.enabled) {
            await this.createWorkflowInstance(config);
        }

        // Persist to storage
        await this.persistWorkflows();

        // Emit event
        this.emit({type: 'workflow_created', workflowId: config.id, config});

        return config.id;
    }

    async updateWorkflow(id: string, config: MacroWorkflowConfig): Promise<void> {
        const existingConfig = this.workflows.get(id);
        if (!existingConfig) {
            throw new Error(`Workflow with ID ${id} not found`);
        }

        // Validate new configuration
        const validation = await this.validateWorkflow(config);
        if (!validation.valid) {
            throw new Error(`Workflow validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }

        // Hot reload: destroy existing instance
        const existingInstance = this.instances.get(id);
        if (existingInstance) {
            await this.destroyWorkflowInstance(id);
        }

        // Update configuration
        const updatedConfig = {
            ...config,
            modified: Date.now(),
            version: existingConfig.version + 1
        };
        this.workflows.set(id, updatedConfig);

        // Recreate instance if it was running or config is enabled
        if ((existingInstance?.status === 'running') || config.enabled) {
            await this.createWorkflowInstance(updatedConfig);
        }

        // Persist changes
        await this.persistWorkflows();

        // Emit event
        this.emit({type: 'workflow_updated', workflowId: id, config: updatedConfig});
    }

    async deleteWorkflow(id: string): Promise<void> {
        if (!this.workflows.has(id)) {
            throw new Error(`Workflow with ID ${id} not found`);
        }

        // Destroy instance if running
        const instance = this.instances.get(id);
        if (instance) {
            await this.destroyWorkflowInstance(id);
        }

        // Remove from storage
        this.workflows.delete(id);
        await this.persistWorkflows();

        // Emit event
        this.emit({type: 'workflow_deleted', workflowId: id});
    }

    getWorkflow(id: string): MacroWorkflowConfig | null {
        return this.workflows.get(id) || null;
    }

    listWorkflows(): MacroWorkflowConfig[] {
        return Array.from(this.workflows.values());
    }

    // =============================================================================
    // TEMPLATE SYSTEM
    // =============================================================================

    async createWorkflowFromTemplate<T extends WorkflowTemplateType>(
        templateId: T,
        config: WorkflowTemplateConfigs[T]
    ): Promise<string> {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }

        const workflowConfig = template.generator(config);
        return this.createWorkflow(workflowConfig);
    }

    getAvailableTemplates(): WorkflowTemplate[] {
        return Array.from(this.templates.values());
    }

    // =============================================================================
    // RUNTIME CONTROL
    // =============================================================================

    async enableWorkflow(id: string): Promise<void> {
        const config = this.workflows.get(id);
        if (!config) {
            throw new Error(`Workflow with ID ${id} not found`);
        }

        if (!config.enabled) {
            config.enabled = true;
            await this.createWorkflowInstance(config);
            await this.persistWorkflows();
            this.emit({type: 'workflow_enabled', workflowId: id});
        }
    }

    async disableWorkflow(id: string): Promise<void> {
        const config = this.workflows.get(id);
        if (!config) {
            throw new Error(`Workflow with ID ${id} not found`);
        }

        if (config.enabled) {
            config.enabled = false;
            await this.destroyWorkflowInstance(id);
            await this.persistWorkflows();
            this.emit({type: 'workflow_disabled', workflowId: id});
        }
    }

    async reloadWorkflow(id: string): Promise<void> {
        const config = this.workflows.get(id);
        if (!config) {
            throw new Error(`Workflow with ID ${id} not found`);
        }

        const instance = this.instances.get(id);
        if (instance && instance.status === 'running') {
            await this.destroyWorkflowInstance(id);
            await this.createWorkflowInstance(config);
        }
    }

    async reloadAllWorkflows(): Promise<void> {
        const reloadPromises = Array.from(this.instances.keys()).map(id => this.reloadWorkflow(id));
        await Promise.all(reloadPromises);
    }

    // =============================================================================
    // VALIDATION
    // =============================================================================

    async validateWorkflow(config: MacroWorkflowConfig): Promise<ValidationResult> {
        return this.validator.validateWorkflow(config, this.macroTypeDefinitions);
    }

    async testWorkflow(config: MacroWorkflowConfig): Promise<FlowTestResult> {
        return this.validator.testWorkflowFlow(config, this.macroTypeDefinitions);
    }

    // =============================================================================
    // TYPE DEFINITIONS
    // =============================================================================

    getMacroTypeDefinition(typeId: keyof MacroTypeConfigs): MacroTypeDefinition | undefined {
        return this.macroTypeDefinitions.get(typeId);
    }

    getAllMacroTypeDefinitions(): MacroTypeDefinition[] {
        return Array.from(this.macroTypeDefinitions.values());
    }

    registerMacroTypeDefinition(definition: MacroTypeDefinition): void {
        this.macroTypeDefinitions.set(definition.id, definition);
    }

    // =============================================================================
    // EVENT SYSTEM
    // =============================================================================

    on(event: WorkflowEvent['type'], handler: (event: WorkflowEvent) => void): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
    }

    off(event: WorkflowEvent['type'], handler: (event: WorkflowEvent) => void): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event: WorkflowEvent): void {
        const handlers = this.eventHandlers.get(event.type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(event);
                } catch (error) {
                    console.error('Error in workflow event handler:', error);
                }
            });
        }
    }

    // =============================================================================
    // PRIVATE IMPLEMENTATION
    // =============================================================================

    private async createWorkflowInstance(config: MacroWorkflowConfig): Promise<void> {
        const instance: WorkflowInstance = {
            id: config.id,
            config,
            status: 'initializing',
            macroInstances: new Map(),
            connections: new Map(),
            metrics: this.createEmptyMetrics(),
            createdAt: Date.now(),
            lastUpdated: Date.now()
        };

        try {
            // Create macro instances
            for (const nodeConfig of config.macros) {
                const macroInstance = await this.createMacroInstance(nodeConfig);
                instance.macroInstances.set(nodeConfig.id, macroInstance);
            }

            // Create connections
            for (const connectionConfig of config.connections) {
                const connection = await this.connectionManager.createConnection(
                    instance.macroInstances.get(connectionConfig.sourceNodeId)!,
                    instance.macroInstances.get(connectionConfig.targetNodeId)!,
                    connectionConfig.sourceOutput || 'default',
                    connectionConfig.targetInput || 'default'
                );
                instance.connections.set(connectionConfig.id, connection);
            }

            instance.status = 'running';
            this.instances.set(config.id, instance);
      
        } catch (error) {
            instance.status = 'error';
            this.instances.set(config.id, instance);
            throw error;
        }
    }

    private async destroyWorkflowInstance(id: string): Promise<void> {
        const instance = this.instances.get(id);
        if (!instance) {
            return;
        }

        try {
            // Disconnect all connections
            for (const connection of instance.connections.values()) {
                await this.connectionManager.disconnectConnection(connection.id);
            }

            // Destroy macro instances
            for (const macroInstance of instance.macroInstances.values()) {
                if (macroInstance.destroy) {
                    await macroInstance.destroy();
                }
            }

            instance.status = 'destroyed';
            this.instances.delete(id);
      
        } catch (error) {
            console.error(`Error destroying workflow instance ${id}:`, error);
            instance.status = 'error';
        }
    }

    private async createMacroInstance(nodeConfig: any): Promise<any> {
        const { Subject } = await import('rxjs');
        
        // Create a proper macro instance with inputs and outputs Maps
        const instance = {
            id: nodeConfig.id,
            type: nodeConfig.type,
            config: nodeConfig.config,
            inputs: new Map(),
            outputs: new Map(),
            subject: new Subject(), // For data flow
            send: (data: any) => {
                instance.subject.next(data);
            }
        };
        
        // Set up default ports based on macro type definition
        const typeDefinition = this.macroTypeDefinitions.get(nodeConfig.type);
        if (typeDefinition) {
            // Add input ports - the Map value should be the Subject itself, not an object
            if (typeDefinition.inputs) {
                for (const inputDef of typeDefinition.inputs) {
                    instance.inputs.set(inputDef.id, new Subject());
                }
            }
            
            // Add output ports - the Map value should be the Subject itself, not an object
            if (typeDefinition.outputs) {
                for (const outputDef of typeDefinition.outputs) {
                    instance.outputs.set(outputDef.id, new Subject());
                }
            }
        } else {
            // Fallback: add default ports - ReactiveConnectionManager expects the Map values to be the actual Subjects
            instance.inputs.set('default', new Subject());
            instance.outputs.set('default', new Subject());
        }

        // Also add common port names that tests might expect
        if (!instance.inputs.has('input')) {
            instance.inputs.set('input', new Subject());
        }
        if (!instance.outputs.has('output')) {
            instance.outputs.set('output', new Subject());
        }
        if (!instance.inputs.has('value')) {
            instance.inputs.set('value', new Subject());
        }
        if (!instance.outputs.has('value')) {
            instance.outputs.set('value', new Subject());
        }

        return instance;
    }

    private loadMacroTypeDefinitions(): void {
        // Access the registered macro types from the registry
        const registeredCalls = (macroTypeRegistry.registerMacroType as any).calls || [];
        
        for (const [macroTypeId, options, callback] of registeredCalls) {
            // Convert registry entries to MacroTypeDefinition format
            const definition: MacroTypeDefinition = {
                id: macroTypeId,
                displayName: macroTypeId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                description: `${macroTypeId} macro`,
                category: this.getCategoryFromType(macroTypeId),
                // Basic schema - could be enhanced based on actual macro configs
                configSchema: {
                    type: 'object',
                    properties: {},
                    additionalProperties: true
                },
                inputs: [{ id: 'value', name: 'Value', type: 'data', required: true }], // Proper port definition
                outputs: [{ id: 'value', name: 'Value', type: 'data', required: true }] // Proper port definition
            };
            
            this.macroTypeDefinitions.set(macroTypeId as keyof MacroTypeConfigs, definition);
        }
        
        // Log loaded types for debugging
        console.log(`Loaded ${this.macroTypeDefinitions.size} macro type definitions:`, 
            Array.from(this.macroTypeDefinitions.keys()));
    }

    private getCategoryFromType(macroTypeId: string): 'input' | 'output' | 'processor' | 'utility' {
        if (macroTypeId.includes('input')) return 'input';
        if (macroTypeId.includes('output')) return 'output';
        if (macroTypeId.includes('mapper') || macroTypeId.includes('processor')) return 'processor';
        return 'utility';
    }

    private async persistWorkflows(): Promise<void> {
        try {
            const workflowsData = Object.fromEntries(this.workflows);
            await this.macroAPI.statesAPI.createPersistentState(this.persistenceKey, workflowsData);
        } catch (error) {
            console.error('Failed to persist workflows:', error);
        }
    }

    private async loadPersistedWorkflows(): Promise<void> {
        try {
            const persistedState = await this.macroAPI.statesAPI.createPersistentState(this.persistenceKey, {});
            const workflowsData = persistedState.getState();
      
            for (const [id, config] of Object.entries(workflowsData)) {
                this.workflows.set(id, config as MacroWorkflowConfig);
            }
        } catch (error) {
            console.error('Failed to load persisted workflows:', error);
        }
    }

    private initializeTemplates(): void {
    // MIDI CC Chain Template
        this.templates.set('midi_cc_chain', {
            id: 'midi_cc_chain',
            name: 'MIDI CC Chain',
            description: 'Maps a MIDI CC input to a MIDI CC output with optional value transformation',
            category: 'MIDI Control',
            generator: (config: any): MacroWorkflowConfig => {
                // Resolve logical configuration to physical devices/channels/CCs
                const resolved = deviceConfigManager.resolveLogicalTemplate(config as LogicalTemplateConfig);
                
                return {
                    id: `cc_chain_${Date.now()}`,
                    name: `${config.inputCC} → ${config.outputCC} (${config.inputDevice}→${config.outputDevice})`,
                    description: `Maps ${config.inputCC} from ${config.inputDevice} to ${config.outputCC} on ${config.outputDevice}`,
                    enabled: true,
                    version: 1,
                    created: Date.now(),
                    modified: Date.now(),
                    macros: [
                        {
                            id: 'input',
                            type: 'midi_control_change_input',
                            position: { x: 100, y: 100 },
                            config: {
                                deviceFilter: resolved.inputDevice,
                                channelFilter: resolved.inputChannel,
                                ccNumberFilter: resolved.inputCC
                            }
                        },
                        ...(config.minValue !== undefined || config.maxValue !== undefined ? [{
                            id: 'processor',
                            type: 'value_mapper' as keyof MacroTypeConfigs,
                            position: { x: 300, y: 100 },
                            config: {
                                inputRange: [0, 127],
                                outputRange: [config.minValue || 0, config.maxValue || 127]
                            }
                        }] : []),
                        {
                            id: 'output',
                            type: 'midi_control_change_output',
                            position: { x: 500, y: 100 },
                            config: {
                                device: resolved.outputDevice,
                                channel: resolved.outputChannel,
                                ccNumber: resolved.outputCC
                            }
                        }
                    ],
                    connections: [
                        {
                            id: 'input-to-output',
                            sourceNodeId: 'input',
                            targetNodeId: config.minValue !== undefined || config.maxValue !== undefined ? 'processor' : 'output',
                            sourceOutput: 'value',
                            targetInput: 'input'
                        },
                        ...(config.minValue !== undefined || config.maxValue !== undefined ? [{
                            id: 'processor-to-output',
                            sourceNodeId: 'processor',
                            targetNodeId: 'output',
                            sourceOutput: 'output',
                            targetInput: 'value'
                        }] : [])
                    ]
                };
            }
        });

        // MIDI Thru Template
        this.templates.set('midi_thru', {
            id: 'midi_thru',
            name: 'MIDI Thru',
            description: 'Routes MIDI from input device to output device',
            category: 'MIDI Routing',
            generator: (config: any): MacroWorkflowConfig => {
                // Resolve logical configuration to physical devices
                const resolved = deviceConfigManager.resolveLogicalTemplate(config as LogicalTemplateConfig);
                
                return {
                    id: `midi_thru_${Date.now()}`,
                    name: `${config.inputDevice} → ${config.outputDevice}`,
                    description: `Routes MIDI from ${config.inputDevice} to ${config.outputDevice}`,
                    enabled: true,
                    version: 1,
                    created: Date.now(),
                    modified: Date.now(),
                    macros: [
                        {
                            id: 'input',
                            type: 'musical_keyboard_input',
                            position: { x: 100, y: 100 },
                            config: { deviceFilter: resolved.inputDevice }
                        },
                        {
                            id: 'output',
                            type: 'musical_keyboard_output',
                            position: { x: 300, y: 100 },
                            config: { device: resolved.outputDevice }
                        }
                    ],
                    connections: [
                        {
                            id: 'thru',
                            sourceNodeId: 'input',
                            targetNodeId: 'output',
                            sourceOutput: 'midi',
                            targetInput: 'midi'
                        }
                    ]
                };
            }
        });
    }

    private createEmptyMetrics(): WorkflowMetrics {
        return {
            totalLatencyMs: 0,
            averageLatencyMs: 0,
            throughputHz: 0,
            errorCount: 0,
            connectionCount: 0,
            activeConnections: 0,
            memoryUsageMB: 0,
            cpuUsagePercent: 0
        };
    }

    private startMetricsMonitoring(): void {
        this.metricsUpdateInterval = setInterval(() => {
            this.updateInstanceMetrics();
        }, this.METRICS_UPDATE_INTERVAL_MS) as NodeJS.Timeout;
    }

    private updateInstanceMetrics(): void {
        for (const instance of this.instances.values()) {
            if (instance.status === 'running') {
                // Update metrics from connection manager
                const connectionMetrics = this.connectionManager.getMetrics();
                instance.metrics = {
                    ...instance.metrics,
                    ...connectionMetrics,
                    connectionCount: instance.connections.size,
                    activeConnections: Array.from(instance.connections.values())
                        .filter(c => c.lastDataTime && Date.now() - c.lastDataTime < 5000).length
                };
                instance.lastUpdated = Date.now();
            }
        }
    }

    // =============================================================================
    // LIFECYCLE
    // =============================================================================

    async initialize(): Promise<void> {
        // Load macro type definitions from registry
        this.loadMacroTypeDefinitions();
        
        await this.loadPersistedWorkflows();
    
        // Start enabled workflows
        for (const config of this.workflows.values()) {
            if (config.enabled) {
                try {
                    await this.createWorkflowInstance(config);
                } catch (error) {
                    console.error(`Failed to start workflow ${config.id}:`, error);
                }
            }
        }
    }

    async destroy(): Promise<void> {
    // Stop metrics monitoring
        if (this.metricsUpdateInterval) {
            clearInterval(this.metricsUpdateInterval as NodeJS.Timeout);
            this.metricsUpdateInterval = null;
        }

        // Destroy all instances
        const destroyPromises = Array.from(this.instances.keys()).map(id => this.destroyWorkflowInstance(id));
        await Promise.all(destroyPromises);

        // Clear event handlers
        this.eventHandlers.clear();
    }
}