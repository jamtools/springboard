import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DynamicMacroManager } from './dynamic_macro_manager';
import { WorkflowValidator } from './workflow_validation';
import { ReactiveConnectionManager } from './reactive_connection_system';
import { 
    MacroWorkflowConfig, 
    MacroTypeDefinition,
    ValidationResult,
    FlowTestResult
} from './dynamic_macro_types';
import { MacroAPI } from './registered_macro_types';

// Mock dependencies
const mockMacroAPI: MacroAPI = {
    midiIO: {} as any,
    createAction: vi.fn(),
    statesAPI: {
        createSharedState: vi.fn().mockReturnValue({
            getState: () => ({}),
            setState: vi.fn()
        }),
        createPersistentState: vi.fn().mockReturnValue({
            getState: () => ({}),
            setState: vi.fn()
        })
    },
    createMacro: vi.fn(),
    isMidiMaestro: vi.fn().mockReturnValue(true),
    moduleAPI: {} as any,
    onDestroy: vi.fn()
};

describe('Dynamic Macro System', () => {
    let dynamicManager: DynamicMacroManager;
    let validator: WorkflowValidator;
    let connectionManager: ReactiveConnectionManager;

    beforeEach(() => {
        dynamicManager = new DynamicMacroManager(mockMacroAPI);
        validator = new WorkflowValidator();
        connectionManager = new ReactiveConnectionManager();
    });

    afterEach(async () => {
        await dynamicManager.destroy();
        await connectionManager.destroy();
    });

    // =============================================================================
    // DYNAMIC WORKFLOW TESTS
    // =============================================================================

    describe('DynamicMacroManager', () => {
        it('should create and manage workflows', async () => {
            const workflow: MacroWorkflowConfig = {
                id: 'test_workflow',
                name: 'Test Workflow',
                description: 'Test workflow for unit tests',
                enabled: true,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros: [
                    {
                        id: 'input1',
                        type: 'midi_control_change_input',
                        position: { x: 100, y: 100 },
                        config: { allowLocal: true }
                    },
                    {
                        id: 'output1', 
                        type: 'midi_control_change_output',
                        position: { x: 300, y: 100 },
                        config: {}
                    }
                ],
                connections: [
                    {
                        id: 'connection1',
                        sourceNodeId: 'input1',
                        targetNodeId: 'output1',
                        sourceOutput: 'value',
                        targetInput: 'value'
                    }
                ]
            };

            await dynamicManager.initialize();
      
            const workflowId = await dynamicManager.createWorkflow(workflow);
            expect(workflowId).toBe(workflow.id);

            const retrievedWorkflow = dynamicManager.getWorkflow(workflowId);
            expect(retrievedWorkflow).toEqual(workflow);

            const workflows = dynamicManager.listWorkflows();
            expect(workflows).toHaveLength(1);
            expect(workflows[0]).toEqual(workflow);
        });

        it('should update workflows with hot reloading', async () => {
            const workflow: MacroWorkflowConfig = {
                id: 'update_test',
                name: 'Update Test',
                description: 'Test workflow updates',
                enabled: true,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros: [],
                connections: []
            };

            await dynamicManager.initialize();
            await dynamicManager.createWorkflow(workflow);

            const updatedWorkflow = {
                ...workflow,
                name: 'Updated Workflow',
                version: 2,
                modified: Date.now()
            };

            await dynamicManager.updateWorkflow(workflow.id, updatedWorkflow);

            const retrieved = dynamicManager.getWorkflow(workflow.id);
            expect(retrieved?.name).toBe('Updated Workflow');
            expect(retrieved?.version).toBe(2);
        });

        it('should delete workflows', async () => {
            const workflow: MacroWorkflowConfig = {
                id: 'delete_test',
                name: 'Delete Test',
                description: 'Test workflow deletion',
                enabled: true,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros: [],
                connections: []
            };

            await dynamicManager.initialize();
            await dynamicManager.createWorkflow(workflow);

            expect(dynamicManager.getWorkflow(workflow.id)).not.toBeNull();

            await dynamicManager.deleteWorkflow(workflow.id);

            expect(dynamicManager.getWorkflow(workflow.id)).toBeNull();
        });

        it('should create workflows from templates', async () => {
            await dynamicManager.initialize();

            const workflowId = await dynamicManager.createWorkflowFromTemplate('midi_cc_chain', {
                inputDevice: 'Test Controller',
                inputChannel: 1,
                inputCC: 1,
                outputDevice: 'Test Synth',
                outputChannel: 2,
                outputCC: 7,
                minValue: 50,
                maxValue: 100
            });

            const workflow = dynamicManager.getWorkflow(workflowId);
            expect(workflow).not.toBeNull();
            expect(workflow?.name).toContain('CC1 → CC7');
            expect(workflow?.macros).toHaveLength(3); // input, processor, output
            expect(workflow?.connections).toHaveLength(2); // input->processor, processor->output
        });

        it('should enable and disable workflows', async () => {
            const workflow: MacroWorkflowConfig = {
                id: 'enable_test',
                name: 'Enable Test',
                description: 'Test workflow enable/disable',
                enabled: false,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros: [],
                connections: []
            };

            await dynamicManager.initialize();
            await dynamicManager.createWorkflow(workflow);

            await dynamicManager.enableWorkflow(workflow.id);
            const enabledWorkflow = dynamicManager.getWorkflow(workflow.id);
            expect(enabledWorkflow?.enabled).toBe(true);

            await dynamicManager.disableWorkflow(workflow.id);
            const disabledWorkflow = dynamicManager.getWorkflow(workflow.id);
            expect(disabledWorkflow?.enabled).toBe(false);
        });

        it('should handle workflow events', async () => {
            const events: any[] = [];
            dynamicManager.on('workflow_created', (event) => events.push(event));
            dynamicManager.on('workflow_updated', (event) => events.push(event));

            const workflow: MacroWorkflowConfig = {
                id: 'event_test',
                name: 'Event Test',
                description: 'Test workflow events',
                enabled: true,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros: [],
                connections: []
            };

            await dynamicManager.initialize();
            await dynamicManager.createWorkflow(workflow);

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe('workflow_created');

            await dynamicManager.updateWorkflow(workflow.id, { ...workflow, name: 'Updated' });

            expect(events).toHaveLength(2);
            expect(events[1].type).toBe('workflow_updated');
        });
    });

    // =============================================================================
    // VALIDATION TESTS
    // =============================================================================

    describe('WorkflowValidator', () => {
        it('should validate workflow schemas', async () => {
            await dynamicManager.initialize();
            
            const validWorkflow: MacroWorkflowConfig = {
                id: 'valid_workflow',
                name: 'Valid Workflow',
                description: 'A valid workflow',
                enabled: true,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros: [
                    {
                        id: 'node1',
                        type: 'midi_control_change_input',
                        position: { x: 100, y: 100 },
                        config: {}
                    }
                ],
                connections: []
            };

            const result = await dynamicManager.validateWorkflow(validWorkflow);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect invalid workflows', async () => {
            const invalidWorkflow = {
                // Missing required fields
                macros: 'invalid', // Should be array
                connections: null  // Should be array
            } as any as MacroWorkflowConfig;

            const result = await validator.validateWorkflow(invalidWorkflow, new Map());
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should validate connections', async () => {
            const workflowWithInvalidConnection: MacroWorkflowConfig = {
                id: 'invalid_connections',
                name: 'Invalid Connections',
                description: 'Workflow with invalid connections',
                enabled: true,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros: [
                    {
                        id: 'node1',
                        type: 'midi_control_change_input',
                        position: { x: 100, y: 100 },
                        config: {}
                    }
                ],
                connections: [
                    {
                        id: 'invalid_connection',
                        sourceNodeId: 'nonexistent_node',
                        targetNodeId: 'node1'
                    }
                ]
            };

            const result = await validator.validateConnections(workflowWithInvalidConnection);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.message.includes('Source node'))).toBe(true);
        });

        it('should detect cycles in workflow graphs', async () => {
            const cyclicWorkflow: MacroWorkflowConfig = {
                id: 'cyclic_workflow',
                name: 'Cyclic Workflow',
                description: 'Workflow with cycles',
                enabled: true,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros: [
                    {
                        id: 'node1',
                        type: 'midi_control_change_input',
                        position: { x: 100, y: 100 },
                        config: {}
                    },
                    {
                        id: 'node2',
                        type: 'midi_control_change_output',
                        position: { x: 200, y: 100 },
                        config: {}
                    }
                ],
                connections: [
                    {
                        id: 'conn1',
                        sourceNodeId: 'node1',
                        targetNodeId: 'node2'
                    },
                    {
                        id: 'conn2', 
                        sourceNodeId: 'node2',
                        targetNodeId: 'node1' // Creates cycle
                    }
                ]
            };

            const result = await validator.validateConnections(cyclicWorkflow);
            expect(result.cycles.length).toBeGreaterThan(0);
            expect(result.valid).toBe(false);
        });

        it('should test workflow flow simulation', async () => {
            await dynamicManager.initialize();
            
            const workflow: MacroWorkflowConfig = {
                id: 'flow_test',
                name: 'Flow Test',
                description: 'Test workflow flow simulation',
                enabled: true,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros: [
                    {
                        id: 'input',
                        type: 'midi_control_change_input',
                        position: { x: 100, y: 100 },
                        config: {}
                    },
                    {
                        id: 'output',
                        type: 'midi_control_change_output',
                        position: { x: 300, y: 100 },
                        config: {}
                    }
                ],
                connections: [
                    {
                        id: 'flow',
                        sourceNodeId: 'input',
                        targetNodeId: 'output'
                    }
                ]
            };

            const result = await dynamicManager.testWorkflow(workflow);
            expect(result.success).toBe(true);
            expect(result.latencyMs).toBeGreaterThanOrEqual(0);
            expect(result.nodeResults).toHaveProperty('input');
            expect(result.nodeResults).toHaveProperty('output');
        });
    });


    // =============================================================================
    // REACTIVE CONNECTION TESTS
    // =============================================================================

    describe('ReactiveConnectionManager', () => {
        it('should create and manage connections', async () => {
            const mockSource = {
                inputs: new Map(),
                outputs: new Map([['default', new (await import('rxjs')).Subject()]]),
                connect: vi.fn(),
                disconnect: vi.fn(),
                getConnectionHealth: vi.fn()
            };

            const mockTarget = {
                inputs: new Map([['default', new (await import('rxjs')).Subject()]]),
                outputs: new Map(),
                connect: vi.fn(),
                disconnect: vi.fn(),
                getConnectionHealth: vi.fn()
            };

            const connection = await connectionManager.createConnection(
                mockSource,
                mockTarget,
                'default',
                'default'
            );

            expect(connection.id).toBeDefined();
            expect(connection.source.port).toBe('default');
            expect(connection.target.port).toBe('default');
            expect(connection.createdAt).toBeGreaterThan(0);
        });

        it('should track connection health', async () => {
            const mockSource = {
                inputs: new Map(),
                outputs: new Map([['default', new (await import('rxjs')).Subject()]]),
                connect: vi.fn(),
                disconnect: vi.fn(),
                getConnectionHealth: vi.fn()
            };

            const mockTarget = {
                inputs: new Map([['default', new (await import('rxjs')).Subject()]]),
                outputs: new Map(),
                connect: vi.fn(),
                disconnect: vi.fn(),
                getConnectionHealth: vi.fn()
            };

            const connection = await connectionManager.createConnection(mockSource, mockTarget);
      
            const health = connectionManager.getConnectionHealth(connection.id);
            expect(health).not.toBeNull();
            expect(health?.isHealthy).toBeDefined();
            expect(health?.errors).toBeDefined();
            expect(health?.lastCheck).toBeGreaterThan(0);
        });

        it('should provide performance metrics', () => {
            const metrics = connectionManager.getMetrics();
            expect(metrics).toHaveProperty('totalLatencyMs');
            expect(metrics).toHaveProperty('averageLatencyMs'); 
            expect(metrics).toHaveProperty('throughputHz');
            expect(metrics).toHaveProperty('errorCount');
            expect(metrics).toHaveProperty('connectionCount');
            expect(metrics).toHaveProperty('activeConnections');
            expect(metrics).toHaveProperty('memoryUsageMB');
            expect(metrics).toHaveProperty('cpuUsagePercent');
        });

        it('should cleanup connections properly', async () => {
            const mockSource = {
                inputs: new Map(),
                outputs: new Map([['default', new (await import('rxjs')).Subject()]]),
                connect: vi.fn(),
                disconnect: vi.fn(),
                getConnectionHealth: vi.fn()
            };

            const mockTarget = {
                inputs: new Map([['default', new (await import('rxjs')).Subject()]]),
                outputs: new Map(),
                connect: vi.fn(),
                disconnect: vi.fn(),
                getConnectionHealth: vi.fn()
            };

            const connection = await connectionManager.createConnection(mockSource, mockTarget);
      
            expect(connectionManager.getConnection(connection.id)).toBeDefined();
      
            await connectionManager.disconnectConnection(connection.id);
      
            expect(connectionManager.getConnection(connection.id)).toBeUndefined();
        });
    });

    // =============================================================================
    // MACRO TYPE DEFINITION TESTS
    // =============================================================================

    describe('MacroTypeDefinitions', () => {
        it('should register and retrieve macro type definitions', async () => {
            const definition: MacroTypeDefinition = {
                id: 'test_macro_type' as any,
                displayName: 'Test Macro Type',
                description: 'A test macro type',
                category: 'utility',
                configSchema: {
                    type: 'object',
                    properties: {
                        testProperty: { type: 'string' }
                    }
                }
            };

            await dynamicManager.initialize();
            dynamicManager.registerMacroTypeDefinition(definition);

            const retrieved = dynamicManager.getMacroTypeDefinition(definition.id);
            expect(retrieved).toEqual(definition);

            const allDefinitions = dynamicManager.getAllMacroTypeDefinitions();
            expect(allDefinitions).toContain(definition);
        });
    });

    // =============================================================================
    // TEMPLATE SYSTEM TESTS
    // =============================================================================

    describe('Template System', () => {
        it('should provide available templates', async () => {
            await dynamicManager.initialize();
      
            const templates = dynamicManager.getAvailableTemplates();
            expect(templates.length).toBeGreaterThan(0);
      
            const ccChainTemplate = templates.find(t => t.id === 'midi_cc_chain');
            expect(ccChainTemplate).toBeDefined();
            expect(ccChainTemplate?.name).toBe('MIDI CC Chain');
      
            const thruTemplate = templates.find(t => t.id === 'midi_thru');
            expect(thruTemplate).toBeDefined();
            expect(thruTemplate?.name).toBe('MIDI Thru');
        });

        it('should generate workflows from templates correctly', async () => {
            await dynamicManager.initialize();
      
            const workflowId = await dynamicManager.createWorkflowFromTemplate('midi_cc_chain', {
                inputDevice: 'Test Input',
                inputChannel: 1,
                inputCC: 1,
                outputDevice: 'Test Output', 
                outputChannel: 2,
                outputCC: 7
            });

            const workflow = dynamicManager.getWorkflow(workflowId);
            expect(workflow).not.toBeNull();
            expect(workflow?.macros).toHaveLength(2); // input + output (no processor without min/max)
            expect(workflow?.connections).toHaveLength(1);
      
            // Check input node configuration
            const inputNode = workflow?.macros.find(m => m.id === 'input');
            expect(inputNode?.config.deviceFilter).toBe('Test Input');
            expect(inputNode?.config.channelFilter).toBe(1);
            expect(inputNode?.config.ccNumberFilter).toBe(1);
      
            // Check output node configuration
            const outputNode = workflow?.macros.find(m => m.id === 'output');
            expect(outputNode?.config.device).toBe('Test Output');
            expect(outputNode?.config.channel).toBe(2);
            expect(outputNode?.config.ccNumber).toBe(7);
        });

        it('should create value processor when min/max values are specified', async () => {
            await dynamicManager.initialize();
      
            const workflowId = await dynamicManager.createWorkflowFromTemplate('midi_cc_chain', {
                inputDevice: 'Test Input',
                inputChannel: 1,
                inputCC: 1,
                outputDevice: 'Test Output',
                outputChannel: 1, 
                outputCC: 7,
                minValue: 50,
                maxValue: 100
            });

            const workflow = dynamicManager.getWorkflow(workflowId);
            expect(workflow).not.toBeNull();
            expect(workflow?.macros).toHaveLength(3); // input + processor + output
            expect(workflow?.connections).toHaveLength(2); // input->processor, processor->output
      
            const processorNode = workflow?.macros.find(m => m.id === 'processor');
            expect(processorNode).toBeDefined();
            expect(processorNode?.config.outputRange).toEqual([50, 100]);
        });
    });

    // =============================================================================
    // PERFORMANCE TESTS
    // =============================================================================

    describe('Performance', () => {
        it('should handle rapid workflow updates', async () => {
            const workflow: MacroWorkflowConfig = {
                id: 'perf_test',
                name: 'Performance Test',
                description: 'Test performance under load',
                enabled: true,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros: [],
                connections: []
            };

            await dynamicManager.initialize();
            await dynamicManager.createWorkflow(workflow);

            const startTime = Date.now();
            const updateCount = 10;

            // Rapid fire updates
            for (let i = 0; i < updateCount; i++) {
                await dynamicManager.updateWorkflow(workflow.id, {
                    ...workflow,
                    version: i + 2,
                    modified: Date.now(),
                    name: `Performance Test ${i}`
                });
            }

            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const avgUpdateTime = totalTime / updateCount;

            // Updates should be fast (less than 100ms each on average)
            expect(avgUpdateTime).toBeLessThan(100);
      
            const finalWorkflow = dynamicManager.getWorkflow(workflow.id);
            expect(finalWorkflow?.version).toBe(updateCount + 1);
            expect(finalWorkflow?.name).toBe(`Performance Test ${updateCount - 1}`);
        });

        it('should validate large workflows efficiently', async () => {
            // Create a large workflow with many nodes and connections
            const nodeCount = 50;
            const macros = Array.from({ length: nodeCount }, (_, i) => ({
                id: `node_${i}`,
                type: i % 2 === 0 ? 'midi_control_change_input' as const : 'midi_control_change_output' as const,
                position: { x: (i % 10) * 100, y: Math.floor(i / 10) * 100 },
                config: {}
            }));

            // Create connections between adjacent nodes
            const connections = [];
            for (let i = 0; i < nodeCount - 1; i += 2) {
                connections.push({
                    id: `conn_${i}`,
                    sourceNodeId: `node_${i}`,
                    targetNodeId: `node_${i + 1}`
                });
            }

            const largeWorkflow: MacroWorkflowConfig = {
                id: 'large_workflow',
                name: 'Large Workflow',
                description: 'Workflow with many nodes for performance testing',
                enabled: true,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros,
                connections
            };

            await dynamicManager.initialize();
            
            const startTime = Date.now();
            const result = await dynamicManager.validateWorkflow(largeWorkflow);
            const endTime = Date.now();

            // Validation should complete in reasonable time (less than 1 second)
            expect(endTime - startTime).toBeLessThan(1000);
            expect(result.valid).toBe(true);
        });
    });

    // =============================================================================
    // ERROR HANDLING TESTS
    // =============================================================================

    describe('Error Handling', () => {
        it('should handle invalid workflow IDs gracefully', async () => {
            await dynamicManager.initialize();
      
            expect(() => dynamicManager.getWorkflow('nonexistent')).not.toThrow();
            expect(dynamicManager.getWorkflow('nonexistent')).toBeNull();
      
            await expect(dynamicManager.updateWorkflow('nonexistent', {} as any))
                .rejects.toThrow();
      
            await expect(dynamicManager.deleteWorkflow('nonexistent'))
                .rejects.toThrow();
        });

        it('should handle duplicate workflow IDs', async () => {
            const workflow: MacroWorkflowConfig = {
                id: 'duplicate_test',
                name: 'Duplicate Test',
                description: 'Test duplicate ID handling',
                enabled: true,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros: [],
                connections: []
            };

            await dynamicManager.initialize();
            await dynamicManager.createWorkflow(workflow);
      
            // Second creation with same ID should fail
            await expect(dynamicManager.createWorkflow(workflow))
                .rejects.toThrow('already exists');
        });

        it('should handle validation errors gracefully', async () => {
            const invalidWorkflow = {
                id: '',  // Invalid: empty ID
                name: '', // Invalid: empty name
                enabled: true,
                version: 1,
                created: Date.now(),
                modified: Date.now(),
                macros: null, // Invalid: should be array
                connections: undefined // Invalid: should be array
            } as any as MacroWorkflowConfig;

            const result = await validator.validateWorkflow(invalidWorkflow, new Map());
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
      
            // Should not throw, just return validation errors
            expect(() => result).not.toThrow();
        });
    });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Integration Tests', () => {
    let dynamicManager: DynamicMacroManager;

    beforeEach(() => {
        dynamicManager = new DynamicMacroManager(mockMacroAPI);
    });

    afterEach(async () => {
        await dynamicManager.destroy();
    });

    it('should support end-to-end workflow lifecycle', async () => {
        await dynamicManager.initialize();

        // 1. Create workflow from template
        const workflowId = await dynamicManager.createWorkflowFromTemplate('midi_cc_chain', {
            inputDevice: 'Controller',
            inputChannel: 1,
            inputCC: 1,
            outputDevice: 'Synth',
            outputChannel: 1,
            outputCC: 7
        });

        // 2. Validate workflow
        const workflow = dynamicManager.getWorkflow(workflowId);
        expect(workflow).not.toBeNull();
    
        const validation = await dynamicManager.validateWorkflow(workflow!);
        expect(validation.valid).toBe(true);

        // 3. Test workflow
        const flowTest = await dynamicManager.testWorkflow(workflow!);
        expect(flowTest.success).toBe(true);

        // 4. Update workflow (hot reload)
        const updatedWorkflow = {
            ...workflow!,
            version: workflow!.version + 1,
            modified: Date.now(),
            macros: workflow!.macros.map(macro => 
                macro.id === 'input' 
                    ? { ...macro, config: { ...macro.config, ccNumberFilter: 2 } }
                    : macro
            )
        };

        await dynamicManager.updateWorkflow(workflowId, updatedWorkflow);

        // 5. Verify update
        const retrievedUpdated = dynamicManager.getWorkflow(workflowId);
        expect(retrievedUpdated?.version).toBe(workflow!.version + 1);

        // 6. Disable and re-enable
        await dynamicManager.disableWorkflow(workflowId);
        expect(dynamicManager.getWorkflow(workflowId)?.enabled).toBe(false);

        await dynamicManager.enableWorkflow(workflowId);
        expect(dynamicManager.getWorkflow(workflowId)?.enabled).toBe(true);

        // 7. Clean up
        await dynamicManager.deleteWorkflow(workflowId);
        expect(dynamicManager.getWorkflow(workflowId)).toBeNull();
    });

});