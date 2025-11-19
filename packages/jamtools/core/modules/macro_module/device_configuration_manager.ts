/**
 * Device Configuration Manager
 * 
 * Provides an abstraction layer between logical MIDI requirements and physical devices.
 * Users configure their MIDI setup once, and feature modules request logical connections
 * that get automatically mapped to actual hardware.
 */

import {Observable, Subject} from 'rxjs';

// =============================================================================
// DEVICE CONFIGURATION TYPES
// =============================================================================

export interface MIDIDeviceConfiguration {
    // Physical MIDI devices
    devices: {
        inputs: MIDIDeviceInfo[];
        outputs: MIDIDeviceInfo[];
    };
    
    // User's logical device assignments
    assignments: {
        [logicalName: string]: DeviceAssignment;
    };
    
    // Channel and CC preferences
    channelMappings: {
        [logicalChannel: string]: number; // 1-16
    };
    
    ccMappings: {
        [logicalCC: string]: number; // 0-127
    };
    
    // User preferences
    preferences: {
        defaultInputLatency: number;
        defaultOutputLatency: number;
        autoDetectDevices: boolean;
        preferredDevicePatterns: string[]; // e.g., ["Arturia", "Novation", "Native Instruments"]
    };
}

export interface MIDIDeviceInfo {
    id: string;
    name: string;
    manufacturer?: string;
    available: boolean;
    type: 'input' | 'output';
    channels?: number[];
}

export interface DeviceAssignment {
    deviceId: string;
    deviceName: string;
    preferredChannels?: number[];
    type: 'input' | 'output';
}

// =============================================================================
// LOGICAL MAPPING TYPES
// =============================================================================

export interface LogicalMIDIRequest {
    // What the feature needs
    purpose: string; // e.g., "main_controller", "drum_output", "filter_control"
    
    // Connection requirements
    connection: {
        type: 'input' | 'output';
        channels?: number | 'any' | number[];
        ccs?: number | 'any' | number[];
        noteRange?: { min: number; max: number };
    };
    
    // Optional constraints
    constraints?: {
        latency?: 'low' | 'medium' | 'high';
        bandwidth?: 'low' | 'medium' | 'high';
        exclusive?: boolean; // If this feature needs dedicated access
    };
    
    // Fallback options
    fallbacks?: string[]; // Other logical names to try if primary fails
}

export interface ResolvedMIDIConnection {
    logicalName: string;
    physicalDevice: MIDIDeviceInfo;
    channel: number;
    cc?: number;
    validated: boolean;
    capabilities: {
        supportsChannels: number[];
        supportsCCs: number[];
        latencyMs: number;
    };
}

// =============================================================================
// USER CONFIGURATION DEFAULTS
// =============================================================================

const DEFAULT_LOGICAL_ASSIGNMENTS = {
    // Controllers
    main_controller: 'Primary MIDI Controller',
    drum_pads: 'Drum Controller',
    keyboard: 'MIDI Keyboard',
    
    // Outputs
    main_synth: 'Primary Synthesizer', 
    drums: 'Drum Machine',
    bass: 'Bass Synthesizer',
    effects: 'Effects Processor',
    
    // Channels
    lead_channel: 1,
    bass_channel: 2,
    drums_channel: 10,
    effects_channel: 3,
    
    // Common CCs
    filter_cutoff: 74,
    resonance: 71,
    attack: 73,
    decay: 75,
    sustain: 79,
    release: 72,
    lfo_rate: 76,
    lfo_depth: 77,
    reverb_send: 91,
    chorus_send: 93,
    
    // User-defined sliders/knobs
    slider_1: 10,
    slider_2: 11,
    slider_3: 12,
    slider_4: 13,
    knob_1: 14,
    knob_2: 15,
    knob_3: 16,
    knob_4: 17,
};

// =============================================================================
// DEVICE CONFIGURATION MANAGER
// =============================================================================

export class DeviceConfigurationManager {
    private config: MIDIDeviceConfiguration;
    private configChanges = new Subject<MIDIDeviceConfiguration>();
    
    constructor() {
        this.config = this.loadOrCreateDefaultConfig();
    }
    
    // =============================================================================
    // USER CONFIGURATION API
    // =============================================================================
    
    /**
     * Get the current device configuration for user editing
     */
    getUserConfiguration(): MIDIDeviceConfiguration {
        return JSON.parse(JSON.stringify(this.config));
    }
    
    /**
     * Update user device configuration
     */
    updateUserConfiguration(updates: Partial<MIDIDeviceConfiguration>): void {
        this.config = { ...this.config, ...updates };
        this.saveConfiguration();
        this.configChanges.next(this.config);
    }
    
    /**
     * Reset to default configuration
     */
    resetToDefaults(): void {
        this.config = this.createDefaultConfig();
        this.saveConfiguration();
        this.configChanges.next(this.config);
    }
    
    /**
     * Auto-detect and suggest device assignments based on connected hardware
     */
    async autoConfigureDevices(): Promise<MIDIDeviceConfiguration> {
        // In a real implementation, this would:
        // 1. Query available MIDI devices via WebMIDI API or platform-specific APIs
        // 2. Apply intelligent matching based on device names and manufacturer
        // 3. Suggest logical assignments based on common patterns
        
        const detectedDevices = await this.detectAvailableDevices();
        const suggested = this.suggestDeviceAssignments(detectedDevices);
        
        return suggested;
    }
    
    // =============================================================================
    // FEATURE MODULE API - THE KEY ABSTRACTION
    // =============================================================================
    
    /**
     * Resolve a logical MIDI request to actual hardware configuration.
     * This is what feature modules call instead of hardcoding devices.
     */
    resolveMIDIRequest(request: LogicalMIDIRequest): ResolvedMIDIConnection {
        const logicalName = request.purpose;
        
        // Try to find logical assignment
        const assignment = this.config.assignments[logicalName];
        if (!assignment) {
            throw new Error(`No device assignment found for logical requirement: ${logicalName}`);
        }
        
        // Find physical device
        const devices = request.connection.type === 'input' ? 
            this.config.devices.inputs : this.config.devices.outputs;
        const physicalDevice = devices.find(d => d.id === assignment.deviceId);
        
        if (!physicalDevice || !physicalDevice.available) {
            // Try fallbacks
            if (request.fallbacks) {
                for (const fallback of request.fallbacks) {
                    const fallbackAssignment = this.config.assignments[fallback];
                    if (fallbackAssignment) {
                        const fallbackDevice = devices.find(d => d.id === fallbackAssignment.deviceId);
                        if (fallbackDevice?.available) {
                            return this.buildResolvedConnection(fallback, fallbackDevice, request);
                        }
                    }
                }
            }
            throw new Error(`Device not available for ${logicalName}: ${assignment.deviceName}`);
        }
        
        return this.buildResolvedConnection(logicalName, physicalDevice, request);
    }
    
    /**
     * Get a logical channel number mapped to actual MIDI channel
     */
    getLogicalChannel(channelName: string): number {
        return this.config.channelMappings[channelName] || 1;
    }
    
    /**
     * Get a logical CC number mapped to actual MIDI CC
     */
    getLogicalCC(ccName: string): number {
        return this.config.ccMappings[ccName] || 1;
    }
    
    /**
     * Observable for configuration changes
     */
    getConfigurationChanges(): Observable<MIDIDeviceConfiguration> {
        return this.configChanges.asObservable();
    }
    
    // =============================================================================
    // TEMPLATE CONFIGURATION RESOLVER
    // =============================================================================
    
    /**
     * Resolve logical template configuration to physical device configuration.
     * This replaces the hardcoded device names in workflow templates.
     */
    resolveLogicalTemplate(logicalConfig: LogicalTemplateConfig): PhysicalTemplateConfig {
        const resolved: PhysicalTemplateConfig = {};
        
        // Map logical device names to physical devices
        if (logicalConfig.inputDevice) {
            const connection = this.resolveMIDIRequest({
                purpose: logicalConfig.inputDevice,
                connection: { type: 'input', channels: 'any' }
            });
            resolved.inputDevice = connection.physicalDevice.name;
        }
        
        if (logicalConfig.outputDevice) {
            const connection = this.resolveMIDIRequest({
                purpose: logicalConfig.outputDevice,
                connection: { type: 'output', channels: 'any' }
            });
            resolved.outputDevice = connection.physicalDevice.name;
        }
        
        // Map logical channels and CCs
        if (logicalConfig.inputChannel) {
            resolved.inputChannel = typeof logicalConfig.inputChannel === 'string' ?
                this.getLogicalChannel(logicalConfig.inputChannel) :
                logicalConfig.inputChannel;
        }
        
        if (logicalConfig.outputChannel) {
            resolved.outputChannel = typeof logicalConfig.outputChannel === 'string' ?
                this.getLogicalChannel(logicalConfig.outputChannel) :
                logicalConfig.outputChannel;
        }
        
        if (logicalConfig.inputCC) {
            resolved.inputCC = typeof logicalConfig.inputCC === 'string' ?
                this.getLogicalCC(logicalConfig.inputCC) :
                logicalConfig.inputCC;
        }
        
        if (logicalConfig.outputCC) {
            resolved.outputCC = typeof logicalConfig.outputCC === 'string' ?
                this.getLogicalCC(logicalConfig.outputCC) :
                logicalConfig.outputCC;
        }
        
        // Pass through other configuration
        if (logicalConfig.minValue !== undefined) resolved.minValue = logicalConfig.minValue;
        if (logicalConfig.maxValue !== undefined) resolved.maxValue = logicalConfig.maxValue;
        if (logicalConfig.channelMap) resolved.channelMap = logicalConfig.channelMap;
        
        return resolved;
    }
    
    // =============================================================================
    // PRIVATE IMPLEMENTATION
    // =============================================================================
    
    private buildResolvedConnection(
        logicalName: string, 
        physicalDevice: MIDIDeviceInfo, 
        request: LogicalMIDIRequest
    ): ResolvedMIDIConnection {
        // Determine channel to use
        let channel = 1;
        if (request.connection.channels === 'any') {
            channel = physicalDevice.channels?.[0] || 1;
        } else if (typeof request.connection.channels === 'number') {
            channel = request.connection.channels;
        }
        
        // Determine CC if needed
        let cc: number | undefined;
        if (request.connection.ccs && request.connection.ccs !== 'any') {
            cc = typeof request.connection.ccs === 'number' ? 
                request.connection.ccs : request.connection.ccs[0];
        }
        
        return {
            logicalName,
            physicalDevice,
            channel,
            cc,
            validated: true,
            capabilities: {
                supportsChannels: physicalDevice.channels || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
                supportsCCs: Array.from({ length: 128 }, (_, i) => i),
                latencyMs: this.config.preferences.defaultInputLatency || 10
            }
        };
    }
    
    private loadOrCreateDefaultConfig(): MIDIDeviceConfiguration {
        // In a real implementation, load from persistent storage
        // For now, return default configuration
        return this.createDefaultConfig();
    }
    
    private createDefaultConfig(): MIDIDeviceConfiguration {
        return {
            devices: {
                inputs: [],
                outputs: []
            },
            assignments: DEFAULT_LOGICAL_ASSIGNMENTS as any,
            channelMappings: {
                lead: 1,
                bass: 2,
                effects: 3,
                drums: 10
            },
            ccMappings: DEFAULT_LOGICAL_ASSIGNMENTS as any,
            preferences: {
                defaultInputLatency: 10,
                defaultOutputLatency: 10,
                autoDetectDevices: true,
                preferredDevicePatterns: ['Arturia', 'Novation', 'Native Instruments', 'Akai', 'Roland']
            }
        };
    }
    
    private saveConfiguration(): void {
        // In a real implementation, persist to storage
        console.log('Device configuration updated:', this.config);
    }
    
    private async detectAvailableDevices(): Promise<MIDIDeviceInfo[]> {
        // Mock implementation - in practice this would use WebMIDI API
        return [
            {
                id: 'mock-controller-1',
                name: 'Arturia KeyLab Essential 49',
                manufacturer: 'Arturia',
                available: true,
                type: 'input',
                channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
            },
            {
                id: 'mock-synth-1',
                name: 'Native Instruments Massive X',
                manufacturer: 'Native Instruments',
                available: true,
                type: 'output',
                channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
            }
        ];
    }
    
    private suggestDeviceAssignments(devices: MIDIDeviceInfo[]): MIDIDeviceConfiguration {
        const assignments: { [key: string]: DeviceAssignment } = {};
        
        // Simple assignment logic - in practice this would be much more sophisticated
        devices.forEach((device, index) => {
            if (device.type === 'input' && !assignments.main_controller) {
                assignments.main_controller = {
                    deviceId: device.id,
                    deviceName: device.name,
                    type: 'input'
                };
            } else if (device.type === 'output' && !assignments.main_synth) {
                assignments.main_synth = {
                    deviceId: device.id,
                    deviceName: device.name,
                    type: 'output'
                };
            }
        });
        
        return {
            ...this.config,
            devices: {
                inputs: devices.filter(d => d.type === 'input'),
                outputs: devices.filter(d => d.type === 'output')
            },
            assignments
        };
    }
}

// =============================================================================
// CONFIGURATION TYPE HELPERS
// =============================================================================

export interface LogicalTemplateConfig {
    // Logical device names (user configurable)
    inputDevice?: string;
    outputDevice?: string;
    
    // Channels - can be logical names or numbers
    inputChannel?: string | number;
    outputChannel?: string | number;
    
    // CCs - can be logical names or numbers  
    inputCC?: string | number;
    outputCC?: string | number;
    
    // Value ranges (direct passthrough)
    minValue?: number;
    maxValue?: number;
    channelMap?: Record<number, number>;
}

export interface PhysicalTemplateConfig {
    // Physical device names (resolved from logical)
    inputDevice?: string;
    outputDevice?: string;
    
    // Actual MIDI channels (resolved from logical)
    inputChannel?: number;
    outputChannel?: number;
    
    // Actual MIDI CCs (resolved from logical)
    inputCC?: number;
    outputCC?: number;
    
    // Value ranges (passthrough)
    minValue?: number;
    maxValue?: number;
    channelMap?: Record<number, number>;
}

// Singleton instance for global access
export const deviceConfigManager = new DeviceConfigurationManager();