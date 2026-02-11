// Simple validation interface to replace AJV dependency
interface JSONSchemaType<T = any> {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
}

interface ValidateFunction {
    (data: any): boolean;
    errors?: Array<{instancePath: string; message: string}> | null;
}

class SimpleValidator {
    allErrors: boolean;
    verbose: boolean;

    constructor(options: {allErrors?: boolean; verbose?: boolean} = {}) {
        this.allErrors = options.allErrors || false;
        this.verbose = options.verbose || false;
    }

    compile(schema: JSONSchemaType): ValidateFunction {
        const validate: ValidateFunction = (data: any): boolean => {
            // Simple validation - just check if data exists for required fields
            if (schema.required) {
                for (const field of schema.required) {
                    if (!data || data[field] === undefined) {
                        (validate as any).errors = [{ instancePath: `/${field}`, message: `Required field '${field}' is missing` }];
                        return false;
                    }
                }
            }
            (validate as any).errors = null;
            return true;
        };
        return validate;
    }
}
import {
    MacroWorkflowConfig,
    MacroNodeConfig,
    MacroConnectionConfig,
    MacroTypeDefinition,
    ValidationResult,
    ValidationError,
    ValidationWarning,
    ConnectionValidationResult,
    FlowTestResult,
    NodeTestResult,
    PerformanceIssue
} from './dynamic_macro_types';
import {MacroTypeConfigs} from './macro_module_types';

/**
 * Comprehensive validation framework for dynamic macro workflows.
 * Provides schema validation, connection validation, and performance testing.
 */
export class WorkflowValidator {
    private ajv: SimpleValidator;
    private validationRules: Map<string, ValidationRule>;
  
    constructor() {
        this.ajv = new SimpleValidator({ allErrors: true, verbose: true });
        this.validationRules = new Map();
        this.initializeBuiltInRules();
    }

    // =============================================================================
    // MAIN VALIDATION METHODS
    // =============================================================================

    async validateWorkflow(
        config: MacroWorkflowConfig,
        macroTypeDefinitions: Map<keyof MacroTypeConfigs, MacroTypeDefinition>
    ): Promise<ValidationResult> {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        try {
            // 1. Schema validation
            const schemaErrors = this.validateWorkflowSchema(config);
            errors.push(...schemaErrors);

            // 2. Node validation
            const nodeErrors = await this.validateNodes(config.macros, macroTypeDefinitions);
            errors.push(...nodeErrors);

            // 3. Connection validation  
            const connectionResult = await this.validateConnections(config);
            errors.push(...connectionResult.errors);
            warnings.push(...connectionResult.warnings);

            // 4. Performance validation
            const performanceWarnings = await this.validatePerformance(config, macroTypeDefinitions);
            warnings.push(...performanceWarnings);

            // 5. Custom rules validation
            const customRuleResults = await this.runCustomValidationRules(config, macroTypeDefinitions);
            errors.push(...customRuleResults.errors);
            warnings.push(...customRuleResults.warnings);

        } catch (error) {
            errors.push({
                type: 'schema',
                message: `Validation failed: ${error}`,
                suggestion: 'Check workflow configuration structure'
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    async validateConnections(config: MacroWorkflowConfig): Promise<ConnectionValidationResult> {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const cycles: string[][] = [];
        const unreachableNodes: string[] = [];
        const performanceIssues: PerformanceIssue[] = [];

        try {
            // Build node and connection maps
            const nodeMap = new Map(config.macros.map(node => [node.id, node]));
            const connectionMap = new Map(config.connections.map(conn => [conn.id, conn]));

            // 1. Validate connection references
            for (const connection of config.connections) {
                if (!nodeMap.has(connection.sourceNodeId)) {
                    errors.push({
                        type: 'connection',
                        connectionId: connection.id,
                        message: `Source node '${connection.sourceNodeId}' not found`,
                        suggestion: 'Ensure all connected nodes exist in the workflow'
                    });
                }

                if (!nodeMap.has(connection.targetNodeId)) {
                    errors.push({
                        type: 'connection',
                        connectionId: connection.id,
                        message: `Target node '${connection.targetNodeId}' not found`,
                        suggestion: 'Ensure all connected nodes exist in the workflow'
                    });
                }

                // Check for self-connections
                if (connection.sourceNodeId === connection.targetNodeId) {
                    warnings.push({
                        type: 'best_practice',
                        nodeId: connection.sourceNodeId,
                        message: 'Node is connected to itself',
                        suggestion: 'Self-connections may cause feedback loops'
                    });
                }
            }

            // 2. Detect cycles in the connection graph
            const detectedCycles = this.detectCycles(config.macros, config.connections);
            cycles.push(...detectedCycles);

            if (cycles.length > 0) {
                errors.push({
                    type: 'connection',
                    message: `Detected ${cycles.length} cycle(s) in workflow graph`,
                    suggestion: 'Remove circular dependencies between nodes'
                });
            }

            // 3. Find unreachable nodes
            const reachableNodes = this.findReachableNodes(config.macros, config.connections);
            const allNodeIds = new Set(config.macros.map(n => n.id));
      
            for (const nodeId of allNodeIds) {
                if (!reachableNodes.has(nodeId)) {
                    unreachableNodes.push(nodeId);
                    warnings.push({
                        type: 'best_practice',
                        nodeId,
                        message: 'Node is not connected to any inputs or outputs',
                        suggestion: 'Consider removing unused nodes or connecting them to the workflow'
                    });
                }
            }

            // 4. Check for potential performance issues
            const performanceChecks = this.checkConnectionPerformance(config);
            performanceIssues.push(...performanceChecks);

            for (const issue of performanceIssues) {
                if (issue.severity === 'high' || issue.severity === 'critical') {
                    errors.push({
                        type: 'performance',
                        nodeId: issue.nodeId,
                        message: `${issue.type}: ${issue.currentValue}${issue.unit} exceeds ${issue.threshold}${issue.unit}`,
                        suggestion: 'Consider optimizing node configuration or reducing connections'
                    });
                } else {
                    warnings.push({
                        type: 'performance',
                        nodeId: issue.nodeId,
                        message: `${issue.type}: ${issue.currentValue}${issue.unit} approaching limit of ${issue.threshold}${issue.unit}`,
                        suggestion: 'Monitor performance during high-load scenarios'
                    });
                }
            }

        } catch (error) {
            errors.push({
                type: 'connection',
                message: `Connection validation failed: ${error}`,
                suggestion: 'Check connection configuration'
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            cycles,
            unreachableNodes,
            performanceIssues
        };
    }

    async testWorkflowFlow(
        config: MacroWorkflowConfig,
        macroTypeDefinitions: Map<keyof MacroTypeConfigs, MacroTypeDefinition>
    ): Promise<FlowTestResult> {
        const nodeResults: Record<string, NodeTestResult> = {};
        const errors: string[] = [];
        let totalLatency = 0;
        let totalThroughput = 0;

        try {
            const startTime = Date.now();

            // Simulate workflow execution
            for (const node of config.macros) {
                const nodeStartTime = Date.now();
        
                try {
                    // Simulate node processing
                    const nodeResult = await this.simulateNodeProcessing(node, macroTypeDefinitions);
                    const nodeEndTime = Date.now();

                    nodeResults[node.id] = {
                        nodeId: node.id,
                        success: nodeResult.success,
                        processingTimeMs: nodeEndTime - nodeStartTime,
                        inputsReceived: nodeResult.inputsReceived,
                        outputsProduced: nodeResult.outputsProduced,
                        errors: nodeResult.errors
                    };

                    if (!nodeResult.success) {
                        errors.push(`Node ${node.id} failed: ${nodeResult.errors.join(', ')}`);
                    }

                    totalLatency += nodeEndTime - nodeStartTime;
                    totalThroughput += nodeResult.outputsProduced;

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    nodeResults[node.id] = {
                        nodeId: node.id,
                        success: false,
                        processingTimeMs: Date.now() - nodeStartTime,
                        inputsReceived: 0,
                        outputsProduced: 0,
                        errors: [errorMessage]
                    };
                    errors.push(`Node ${node.id} threw exception: ${errorMessage}`);
                }
            }

            const endTime = Date.now();
            const testDurationMs = endTime - startTime;

            return {
                success: errors.length === 0,
                latencyMs: totalLatency,
                throughputHz: testDurationMs > 0 ? (totalThroughput * 1000) / testDurationMs : 0,
                errors,
                nodeResults
            };

        } catch (error) {
            return {
                success: false,
                latencyMs: 0,
                throughputHz: 0,
                errors: [`Flow test failed: ${error}`],
                nodeResults
            };
        }
    }

    // =============================================================================
    // SCHEMA VALIDATION
    // =============================================================================

    private validateWorkflowSchema(config: MacroWorkflowConfig): ValidationError[] {
        const errors: ValidationError[] = [];

        // Basic required fields
        if (!config.id) {
            errors.push({
                type: 'schema',
                field: 'id',
                message: 'Workflow ID is required',
                suggestion: 'Provide a unique identifier for the workflow'
            });
        }

        if (!config.name) {
            errors.push({
                type: 'schema',
                field: 'name',
                message: 'Workflow name is required',
                suggestion: 'Provide a descriptive name for the workflow'
            });
        }

        if (!Array.isArray(config.macros)) {
            errors.push({
                type: 'schema',
                field: 'macros',
                message: 'Macros must be an array',
                suggestion: 'Provide an array of macro node configurations'
            });
        }

        if (!Array.isArray(config.connections)) {
            errors.push({
                type: 'schema',
                field: 'connections',
                message: 'Connections must be an array',
                suggestion: 'Provide an array of connection configurations'
            });
        }

        // Validate version and timestamps
        if (typeof config.version !== 'number' || config.version < 1) {
            errors.push({
                type: 'schema',
                field: 'version',
                message: 'Version must be a positive number',
                suggestion: 'Start with version 1 and increment for updates'
            });
        }

        return errors;
    }

    // =============================================================================
    // NODE VALIDATION
    // =============================================================================

    private async validateNodes(
        nodes: MacroNodeConfig[],
        macroTypeDefinitions: Map<keyof MacroTypeConfigs, MacroTypeDefinition>
    ): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        const nodeIds = new Set<string>();

        for (const node of nodes) {
            // Check for duplicate IDs
            if (nodeIds.has(node.id)) {
                errors.push({
                    type: 'schema',
                    nodeId: node.id,
                    message: 'Duplicate node ID found',
                    suggestion: 'Each node must have a unique ID'
                });
            }
            nodeIds.add(node.id);

            // Validate macro type exists
            const typeDefinition = macroTypeDefinitions.get(node.type);
            if (!typeDefinition) {
                errors.push({
                    type: 'dependency',
                    nodeId: node.id,
                    message: `Unknown macro type: ${node.type}`,
                    suggestion: 'Ensure the macro type is registered and available'
                });
                continue;
            }

            // Validate node configuration against schema
            if (typeDefinition.configSchema) {
                try {
                    const validate = this.ajv.compile(typeDefinition.configSchema);
                    const valid = validate(node.config);
          
                    if (!valid && validate.errors) {
                        for (const error of validate.errors) {
                            errors.push({
                                type: 'schema',
                                nodeId: node.id,
                                field: error.instancePath,
                                message: `Configuration validation failed: ${error.message}`,
                                suggestion: 'Check node configuration against expected schema'
                            });
                        }
                    }
                } catch (schemaError) {
                    errors.push({
                        type: 'schema',
                        nodeId: node.id,
                        message: `Schema validation failed: ${schemaError}`,
                        suggestion: 'Check macro type definition schema'
                    });
                }
            }

            // Validate position
            if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
                errors.push({
                    type: 'schema',
                    nodeId: node.id,
                    field: 'position',
                    message: 'Node position must have numeric x and y coordinates',
                    suggestion: 'Provide valid position coordinates for UI layout'
                });
            }
        }

        return errors;
    }

    // =============================================================================
    // GRAPH ANALYSIS
    // =============================================================================

    private detectCycles(nodes: MacroNodeConfig[], connections: MacroConnectionConfig[]): string[][] {
        const adjacencyList = new Map<string, string[]>();
        const cycles: string[][] = [];

        // Build adjacency list
        for (const node of nodes) {
            adjacencyList.set(node.id, []);
        }

        for (const connection of connections) {
            const targets = adjacencyList.get(connection.sourceNodeId) || [];
            targets.push(connection.targetNodeId);
            adjacencyList.set(connection.sourceNodeId, targets);
        }

        // DFS-based cycle detection
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const dfs = (nodeId: string, path: string[]): void => {
            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);

            const neighbors = adjacencyList.get(nodeId) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    dfs(neighbor, [...path]);
                } else if (recursionStack.has(neighbor)) {
                    // Cycle detected
                    const cycleStart = path.indexOf(neighbor);
                    const cycle = path.slice(cycleStart);
                    cycles.push([...cycle, neighbor]);
                }
            }

            recursionStack.delete(nodeId);
        };

        for (const node of nodes) {
            if (!visited.has(node.id)) {
                dfs(node.id, []);
            }
        }

        return cycles;
    }

    private findReachableNodes(nodes: MacroNodeConfig[], connections: MacroConnectionConfig[]): Set<string> {
        const reachable = new Set<string>();
        const inputNodes = new Set<string>();
        const outputNodes = new Set<string>();

        // Identify input and output nodes
        const connectionTargets = new Set(connections.map(c => c.targetNodeId));
        const connectionSources = new Set(connections.map(c => c.sourceNodeId));

        for (const node of nodes) {
            if (!connectionTargets.has(node.id)) {
                inputNodes.add(node.id); // No incoming connections = input
            }
            if (!connectionSources.has(node.id)) {
                outputNodes.add(node.id); // No outgoing connections = output
            }
        }

        // BFS from input nodes
        const queue = Array.from(inputNodes);
        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;

            visited.add(current);
            reachable.add(current);

            // Add connected nodes to queue
            for (const connection of connections) {
                if (connection.sourceNodeId === current && !visited.has(connection.targetNodeId)) {
                    queue.push(connection.targetNodeId);
                }
            }
        }

        return reachable;
    }

    // =============================================================================
    // PERFORMANCE VALIDATION
    // =============================================================================

    private async validatePerformance(
        config: MacroWorkflowConfig,
        macroTypeDefinitions: Map<keyof MacroTypeConfigs, MacroTypeDefinition>
    ): Promise<ValidationWarning[]> {
        const warnings: ValidationWarning[] = [];

        // Check for excessive node count
        if (config.macros.length > 50) {
            warnings.push({
                type: 'performance',
                message: `High node count (${config.macros.length}) may impact performance`,
                suggestion: 'Consider breaking into smaller workflows'
            });
        }

        // Check for excessive connection count
        if (config.connections.length > 100) {
            warnings.push({
                type: 'performance',
                message: `High connection count (${config.connections.length}) may impact performance`,
                suggestion: 'Optimize connection patterns'
            });
        }

        // Check for potential hotspots
        const connectionCounts = new Map<string, number>();
        for (const connection of config.connections) {
            connectionCounts.set(connection.targetNodeId, 
                (connectionCounts.get(connection.targetNodeId) || 0) + 1);
        }

        for (const [nodeId, count] of connectionCounts) {
            if (count > 10) {
                warnings.push({
                    type: 'performance',
                    nodeId,
                    message: `Node has ${count} incoming connections (potential bottleneck)`,
                    suggestion: 'Consider using intermediate processing nodes'
                });
            }
        }

        return warnings;
    }

    private checkConnectionPerformance(config: MacroWorkflowConfig): PerformanceIssue[] {
        const issues: PerformanceIssue[] = [];

        // Analyze connection density
        const nodeCount = config.macros.length;
        const connectionCount = config.connections.length;
        const density = nodeCount > 0 ? connectionCount / (nodeCount * (nodeCount - 1)) : 0;

        if (density > 0.3) {
            issues.push({
                type: 'high_throughput',
                nodeId: 'workflow',
                severity: 'medium',
                currentValue: Math.round(density * 100),
                threshold: 30,
                unit: '%'
            });
        }

        // Check for fan-out patterns
        const fanOut = new Map<string, number>();
        for (const connection of config.connections) {
            fanOut.set(connection.sourceNodeId, 
                (fanOut.get(connection.sourceNodeId) || 0) + 1);
        }

        for (const [nodeId, count] of fanOut) {
            if (count > 5) {
                issues.push({
                    type: 'high_throughput',
                    nodeId,
                    severity: count > 10 ? 'high' : 'medium',
                    currentValue: count,
                    threshold: 5,
                    unit: 'connections'
                });
            }
        }

        return issues;
    }

    // =============================================================================
    // SIMULATION AND TESTING
    // =============================================================================

    private async simulateNodeProcessing(
        node: MacroNodeConfig,
        macroTypeDefinitions: Map<keyof MacroTypeConfigs, MacroTypeDefinition>
    ): Promise<{
            success: boolean;
            inputsReceived: number;
            outputsProduced: number;
            errors: string[];
        }> {
        const typeDefinition = macroTypeDefinitions.get(node.type);
    
        if (!typeDefinition) {
            return {
                success: false,
                inputsReceived: 0,
                outputsProduced: 0,
                errors: [`Unknown macro type: ${node.type}`]
            };
        }

        // Simulate processing based on macro type
        const simulationDelay = Math.random() * 5; // Random delay 0-5ms
        await new Promise(resolve => setTimeout(resolve, simulationDelay));

        // Mock successful processing
        return {
            success: true,
            inputsReceived: 1,
            outputsProduced: typeDefinition.outputs?.length || 1,
            errors: []
        };
    }

    // =============================================================================
    // CUSTOM VALIDATION RULES
    // =============================================================================

    private async runCustomValidationRules(
        config: MacroWorkflowConfig,
        macroTypeDefinitions: Map<keyof MacroTypeConfigs, MacroTypeDefinition>
    ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Run all registered custom rules
        for (const rule of this.validationRules.values()) {
            try {
                const result = await rule.validate(config, macroTypeDefinitions);
                errors.push(...result.errors);
                warnings.push(...result.warnings);
            } catch (error) {
                errors.push({
                    type: 'schema',
                    message: `Custom validation rule failed: ${error}`,
                    suggestion: 'Check custom validation rule implementation'
                });
            }
        }

        return { errors, warnings };
    }

    private initializeBuiltInRules(): void {
    // MIDI-specific validation rule
        this.addValidationRule('midi_device_availability', {
            validate: async (config) => {
                const errors: ValidationError[] = [];
                const warnings: ValidationWarning[] = [];

                // Check for MIDI device references
                for (const node of config.macros) {
                    if (node.type.includes('midi') && node.config.device) {
                        // In a real implementation, this would check actual MIDI device availability
                        if (node.config.device === 'Unknown Device') {
                            warnings.push({
                                type: 'compatibility',
                                nodeId: node.id,
                                message: `MIDI device '${node.config.device}' may not be available`,
                                suggestion: 'Verify MIDI device is connected and accessible'
                            });
                        }
                    }
                }

                return { valid: errors.length === 0, errors, warnings };
            }
        });

        // Performance threshold rule
        this.addValidationRule('performance_thresholds', {
            validate: async (config) => {
                const errors: ValidationError[] = [];
                const warnings: ValidationWarning[] = [];

                // Check for potential real-time performance issues
                const midiNodeCount = config.macros.filter(n => n.type.includes('midi')).length;
                if (midiNodeCount > 20) {
                    warnings.push({
                        type: 'performance',
                        message: `High MIDI node count (${midiNodeCount}) may exceed real-time processing limits`,
                        suggestion: 'Consider optimizing MIDI processing or splitting workflows'
                    });
                }

                return { valid: errors.length === 0, errors, warnings };
            }
        });
    }

    addValidationRule(name: string, rule: ValidationRule): void {
        this.validationRules.set(name, rule);
    }

    removeValidationRule(name: string): void {
        this.validationRules.delete(name);
    }
}

// =============================================================================
// VALIDATION RULE INTERFACE
// =============================================================================

interface ValidationRule {
    validate(
        config: MacroWorkflowConfig,
        macroTypeDefinitions: Map<keyof MacroTypeConfigs, MacroTypeDefinition>
    ): Promise<ValidationResult>;
}