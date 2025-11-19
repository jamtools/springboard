// Simple JSON schema interface for basic validation
interface JSONSchema4 {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
}
import {Observable, Subject} from 'rxjs';
import {MacroTypeConfigs, MidiEventFull} from './macro_module_types';

/**
 * Core types for the dynamic macro workflow system.
 * This enables data-driven macro configuration and runtime reconfiguration.
 */

// =============================================================================
// WORKFLOW CONFIGURATION TYPES
// =============================================================================

export interface MacroWorkflowConfig {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    version: number;
    created: number; // timestamp
    modified: number; // timestamp
    macros: MacroNodeConfig[];
    connections: MacroConnectionConfig[];
    metadata?: Record<string, any>;
}

export interface MacroNodeConfig {
    id: string;
    type: keyof MacroTypeConfigs;
    position: { x: number; y: number };
    config: any; // Will be type-safe based on macro type
    customName?: string;
    enabled?: boolean;
}

export interface MacroConnectionConfig {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceOutput?: string;
    targetInput?: string;
    enabled?: boolean;
}

// =============================================================================
// MACRO TYPE DEFINITION SYSTEM
// =============================================================================

export interface MacroTypeDefinition {
    id: keyof MacroTypeConfigs;
    displayName: string;
    description: string;
    category: 'input' | 'output' | 'processor' | 'utility';
    icon?: string;
    configSchema: JSONSchema4;
    inputs?: MacroPortDefinition[];
    outputs?: MacroPortDefinition[];
    tags?: string[];
    version?: string;
}

export interface MacroPortDefinition {
    id: string;
    name: string;
    type: 'midi' | 'control' | 'data' | 'trigger';
    required: boolean;
    description?: string;
}

// =============================================================================
// WORKFLOW TEMPLATES
// =============================================================================

export type WorkflowTemplateType = 'midi_cc_chain' | 'midi_thru' | 'custom';

export interface WorkflowTemplateConfigs {
    midi_cc_chain: {
        // Logical device identifiers (user-configurable)
        inputDevice: string;    // e.g., "main_controller", "drum_pads" 
        outputDevice: string;   // e.g., "main_synth", "effects"
        
        // Logical or physical channel/CC numbers
        inputChannel: string | number;  // e.g., "lead" or 1
        outputChannel: string | number; // e.g., "bass" or 2
        inputCC: string | number;       // e.g., "filter_cutoff" or 74
        outputCC: string | number;      // e.g., "resonance" or 71
        
        // Value ranges
        minValue?: number;
        maxValue?: number;
    };
    midi_thru: {
        // Logical device identifiers
        inputDevice: string;    // e.g., "main_controller"
        outputDevice: string;   // e.g., "main_synth"
        channelMap?: Record<number, number>;
    };
    custom: {
        nodes: Omit<MacroNodeConfig, 'id' | 'position'>[];
        connections: Omit<MacroConnectionConfig, 'id'>[];
    };
}

export interface WorkflowTemplate<T extends WorkflowTemplateType = WorkflowTemplateType> {
    id: T;
    name: string;
    description: string;
    category: string;
    generator: (config: WorkflowTemplateConfigs[T]) => MacroWorkflowConfig;
}

// =============================================================================
// REACTIVE CONNECTION SYSTEM
// =============================================================================

export interface ConnectableMacroHandler {
    inputs: Map<string, Subject<any>>;
    outputs: Map<string, Observable<any>>;
    connect(outputPort: string, target: ConnectableMacroHandler, inputPort: string): ConnectionHandle;
    disconnect(connectionId: string): void;
    getConnectionHealth(): ConnectionHealth;
}

export interface ConnectionHandle {
    id: string;
    source: { nodeId: string; port: string };
    target: { nodeId: string; port: string };
    subscription: any; // RxJS subscription
    createdAt: number;
    lastDataTime?: number;
}

export interface ConnectionHealth {
    isHealthy: boolean;
    latencyMs?: number;
    throughputHz?: number;
    errors: ConnectionError[];
    lastCheck: number;
}

export interface ConnectionError {
    timestamp: number;
    type: 'timeout' | 'overflow' | 'data_error' | 'connection_lost';
    message: string;
    recoverable: boolean;
}

// =============================================================================
// VALIDATION SYSTEM
// =============================================================================

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

export interface ValidationError {
    type: 'schema' | 'connection' | 'dependency' | 'performance';
    nodeId?: string;
    connectionId?: string;
    field?: string;
    message: string;
    suggestion?: string;
}

export interface ValidationWarning {
    type: 'performance' | 'compatibility' | 'best_practice';
    nodeId?: string;
    message: string;
    suggestion?: string;
}

export interface ConnectionValidationResult extends ValidationResult {
    cycles: string[][]; // Array of node ID cycles
    unreachableNodes: string[];
    performanceIssues: PerformanceIssue[];
}

export interface PerformanceIssue {
    type: 'high_latency' | 'high_throughput' | 'memory_leak' | 'cpu_intensive';
    nodeId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    currentValue: number;
    threshold: number;
    unit: string;
}

export interface FlowTestResult {
    success: boolean;
    latencyMs: number;
    throughputHz: number;
    errors: string[];
    nodeResults: Record<string, NodeTestResult>;
}

export interface NodeTestResult {
    nodeId: string;
    success: boolean;
    processingTimeMs: number;
    inputsReceived: number;
    outputsProduced: number;
    errors: string[];
}

// =============================================================================
// WORKFLOW INSTANCE MANAGEMENT
// =============================================================================

export interface WorkflowInstance {
    id: string;
    config: MacroWorkflowConfig;
    status: 'initializing' | 'running' | 'paused' | 'error' | 'destroyed';
    macroInstances: Map<string, any>;
    connections: Map<string, ConnectionHandle>;
    metrics: WorkflowMetrics;
    createdAt: number;
    lastUpdated: number;
}

export interface WorkflowMetrics {
    totalLatencyMs: number;
    averageLatencyMs: number;
    throughputHz: number;
    errorCount: number;
    connectionCount: number;
    activeConnections: number;
    memoryUsageMB: number;
    cpuUsagePercent: number;
}

// =============================================================================
// MIGRATION AND COMPATIBILITY
// =============================================================================

export interface LegacyMacroInfo {
    moduleId: string;
    macroName: string;
    macroType: keyof MacroTypeConfigs;
    config: any;
    instance: any;
    migrationStatus: 'pending' | 'migrated' | 'error';
}

export interface MigrationResult {
    success: boolean;
    workflowId?: string;
    errors: string[];
    warnings: string[];
    legacyMacrosCount: number;
    migratedMacrosCount: number;
}

// =============================================================================
// ENHANCED MACRO MODULE INTEGRATION
// =============================================================================

export interface DynamicMacroAPI {
    // Workflow management
    createWorkflow(config: MacroWorkflowConfig): Promise<string>;
    updateWorkflow(id: string, config: MacroWorkflowConfig): Promise<void>;
    deleteWorkflow(id: string): Promise<void>;
    getWorkflow(id: string): MacroWorkflowConfig | null;
    listWorkflows(): MacroWorkflowConfig[];
  
    // Template system
    createWorkflowFromTemplate<T extends WorkflowTemplateType>(
        templateId: T, 
        config: WorkflowTemplateConfigs[T]
    ): Promise<string>;
    getAvailableTemplates(): WorkflowTemplate[];
  
    // Runtime control
    enableWorkflow(id: string): Promise<void>;
    disableWorkflow(id: string): Promise<void>;
    reloadWorkflow(id: string): Promise<void>;
    reloadAllWorkflows(): Promise<void>;
  
    // Validation
    validateWorkflow(config: MacroWorkflowConfig): Promise<ValidationResult>;
    testWorkflow(config: MacroWorkflowConfig): Promise<FlowTestResult>;
  
  
    // Type definitions
    getMacroTypeDefinition(typeId: keyof MacroTypeConfigs): MacroTypeDefinition | undefined;
    getAllMacroTypeDefinitions(): MacroTypeDefinition[];
    registerMacroTypeDefinition(definition: MacroTypeDefinition): void;
}

// =============================================================================
// TYPE-SAFE CONFIGURATION
// =============================================================================

export type TypeSafeWorkflowConfig<T extends WorkflowTemplateType> = {
    id: string;
    template: T;
    config: WorkflowTemplateConfigs[T];
} & Omit<MacroWorkflowConfig, 'macros' | 'connections'>;

// =============================================================================
// EVENT SYSTEM
// =============================================================================

export type WorkflowEvent = 
  | { type: 'workflow_created'; workflowId: string; config: MacroWorkflowConfig }
  | { type: 'workflow_updated'; workflowId: string; config: MacroWorkflowConfig }
  | { type: 'workflow_deleted'; workflowId: string }
  | { type: 'workflow_enabled'; workflowId: string }
  | { type: 'workflow_disabled'; workflowId: string }
  | { type: 'connection_established'; connectionId: string; source: string; target: string }
  | { type: 'connection_lost'; connectionId: string; reason: string }
  | { type: 'validation_error'; workflowId: string; errors: ValidationError[] }
  | { type: 'performance_warning'; workflowId: string; issue: PerformanceIssue };

export interface WorkflowEventEmitter {
    on(event: WorkflowEvent['type'], handler: (event: WorkflowEvent) => void): void;
    off(event: WorkflowEvent['type'], handler: (event: WorkflowEvent) => void): void;
    emit(event: WorkflowEvent): void;
}