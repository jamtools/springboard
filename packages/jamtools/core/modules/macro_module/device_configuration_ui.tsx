import React, {useState, useEffect} from 'react';
import {deviceConfigManager} from './device_configuration_manager';
import type {MIDIDeviceConfiguration} from './device_configuration_manager';

/**
 * User interface for configuring MIDI device mappings.
 * This is where users set up the logical-to-physical device mappings
 * that the dynamic workflow system uses.
 */

export const DeviceConfigurationUI: React.FC = () => {
    const [config, setConfig] = useState<MIDIDeviceConfiguration | null>(null);
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        // Load current configuration
        const currentConfig = deviceConfigManager.getUserConfiguration();
        setConfig(currentConfig);

        // Subscribe to configuration changes
        const subscription = deviceConfigManager.getConfigurationChanges().subscribe(newConfig => {
            setConfig(newConfig);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleAutoDetect = async () => {
        const suggested = await deviceConfigManager.autoConfigureDevices();
        setConfig(suggested);
    };

    const handleSaveAssignment = (logicalName: string, deviceName: string, deviceType: 'input' | 'output') => {
        if (!config) return;

        const updatedConfig = {
            ...config,
            assignments: {
                ...config.assignments,
                [logicalName]: {
                    deviceId: `mock-${deviceType}-${logicalName}`,
                    deviceName,
                    type: deviceType
                }
            }
        };

        deviceConfigManager.updateUserConfiguration(updatedConfig);
    };

    const handleSaveChannelMapping = (logicalChannel: string, physicalChannel: number) => {
        if (!config) return;

        const updatedConfig = {
            ...config,
            channelMappings: {
                ...config.channelMappings,
                [logicalChannel]: physicalChannel
            }
        };

        deviceConfigManager.updateUserConfiguration(updatedConfig);
    };

    const handleSaveCCMapping = (logicalCC: string, physicalCC: number) => {
        if (!config) return;

        const updatedConfig = {
            ...config,
            ccMappings: {
                ...config.ccMappings,
                [logicalCC]: physicalCC
            }
        };

        deviceConfigManager.updateUserConfiguration(updatedConfig);
    };

    if (!config) {
        return <div>Loading device configuration...</div>;
    }

    return (
        <div style={{padding: '20px', fontFamily: 'system-ui'}}>
            <h2>🎛️ MIDI Device Configuration</h2>
            <p>Configure how logical device names in your workflows map to actual MIDI hardware.</p>

            <div style={{marginBottom: '20px', padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '8px'}}>
                <h3>Why This Matters</h3>
                <p>Instead of hardcoding "Arturia KeyLab" in every workflow, you can use logical names like "main_controller".</p>
                <p>Change your hardware? Just update the mappings here - all your workflows automatically use the new device!</p>
            </div>

            <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
                <button onClick={handleAutoDetect} style={{padding: '8px 16px'}}>
                    🔍 Auto-Detect Devices
                </button>
                <button 
                    onClick={() => setEditMode(!editMode)} 
                    style={{padding: '8px 16px', backgroundColor: editMode ? '#ff6b6b' : '#4dabf7', color: 'white', border: 'none', borderRadius: '4px'}}
                >
                    {editMode ? 'View Mode' : 'Edit Mode'}
                </button>
                <button 
                    onClick={() => deviceConfigManager.resetToDefaults()} 
                    style={{padding: '8px 16px', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '4px'}}
                >
                    Reset to Defaults
                </button>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                {/* Device Assignments */}
                <div>
                    <h3>📱 Device Assignments</h3>
                    <div style={{backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '6px'}}>
                        <h4>Input Devices</h4>
                        {Object.entries(config.assignments)
                            .filter(([_, assignment]) => assignment.type === 'input')
                            .map(([logical, assignment]) => (
                                <DeviceAssignmentRow 
                                    key={logical}
                                    logicalName={logical}
                                    assignment={assignment}
                                    editMode={editMode}
                                    onSave={(deviceName) => handleSaveAssignment(logical, deviceName, 'input')}
                                />
                        ))}

                        <h4>Output Devices</h4>
                        {Object.entries(config.assignments)
                            .filter(([_, assignment]) => assignment.type === 'output')
                            .map(([logical, assignment]) => (
                                <DeviceAssignmentRow 
                                    key={logical}
                                    logicalName={logical}
                                    assignment={assignment}
                                    editMode={editMode}
                                    onSave={(deviceName) => handleSaveAssignment(logical, deviceName, 'output')}
                                />
                        ))}
                    </div>
                </div>

                {/* Channel & CC Mappings */}
                <div>
                    <h3>🎚️ Channel & CC Mappings</h3>
                    <div style={{backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '6px'}}>
                        <h4>Logical Channels</h4>
                        {Object.entries(config.channelMappings).map(([logical, physical]) => (
                            <MappingRow 
                                key={logical}
                                logicalName={logical}
                                physicalValue={physical}
                                editMode={editMode}
                                type="channel"
                                onSave={(value) => handleSaveChannelMapping(logical, value)}
                            />
                        ))}

                        <h4>Logical Control Changes</h4>
                        <div style={{maxHeight: '300px', overflowY: 'auto'}}>
                            {Object.entries(config.ccMappings).map(([logical, physical]) => (
                                <MappingRow 
                                    key={logical}
                                    logicalName={logical}
                                    physicalValue={physical}
                                    editMode={editMode}
                                    type="cc"
                                    onSave={(value) => handleSaveCCMapping(logical, value)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '6px'}}>
                <h3>💡 Usage Examples</h3>
                <code style={{display: 'block', backgroundColor: 'white', padding: '10px', borderRadius: '4px', marginBottom: '8px'}}>
                    {`// In your workflows, use logical names:\n`}
                    {`inputDevice: 'main_controller'  // Maps to ${config.assignments.main_controller?.deviceName || 'your configured device'}\n`}
                    {`inputCC: 'filter_cutoff'       // Maps to CC${config.ccMappings.filter_cutoff || 74}\n`}
                    {`outputChannel: 'lead'          // Maps to channel ${config.channelMappings.lead || 1}`}
                </code>
                <p>When you change hardware, just update the mappings above - all workflows adapt automatically!</p>
            </div>
        </div>
    );
};

interface DeviceAssignmentRowProps {
    logicalName: string;
    assignment: any;
    editMode: boolean;
    onSave: (deviceName: string) => void;
}

const DeviceAssignmentRow: React.FC<DeviceAssignmentRowProps> = ({
    logicalName, assignment, editMode, onSave
}) => {
    const [editValue, setEditValue] = useState(assignment.deviceName);

    return (
        <div style={{display: 'flex', alignItems: 'center', marginBottom: '8px', padding: '8px', backgroundColor: 'white', borderRadius: '4px'}}>
            <strong style={{minWidth: '140px', fontSize: '14px'}}>{logicalName}:</strong>
            {editMode ? (
                <div style={{display: 'flex', gap: '8px', flex: 1}}>
                    <input 
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{flex: 1, padding: '4px'}}
                        placeholder="Device name"
                    />
                    <button 
                        onClick={() => onSave(editValue)}
                        style={{padding: '4px 8px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px'}}
                    >
                        Save
                    </button>
                </div>
            ) : (
                <span style={{color: '#666', fontSize: '14px'}}>{assignment.deviceName}</span>
            )}
        </div>
    );
};

interface MappingRowProps {
    logicalName: string;
    physicalValue: number;
    editMode: boolean;
    type: 'channel' | 'cc';
    onSave: (value: number) => void;
}

const MappingRow: React.FC<MappingRowProps> = ({
    logicalName, physicalValue, editMode, type, onSave
}) => {
    const [editValue, setEditValue] = useState(physicalValue.toString());

    return (
        <div style={{display: 'flex', alignItems: 'center', marginBottom: '6px', padding: '6px', backgroundColor: 'white', borderRadius: '3px'}}>
            <strong style={{minWidth: '120px', fontSize: '13px'}}>{logicalName}:</strong>
            {editMode ? (
                <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                    <input 
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{width: '60px', padding: '2px 4px'}}
                        min={type === 'channel' ? '1' : '0'}
                        max={type === 'channel' ? '16' : '127'}
                    />
                    <button 
                        onClick={() => onSave(parseInt(editValue) || physicalValue)}
                        style={{padding: '2px 6px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px'}}
                    >
                        Save
                    </button>
                </div>
            ) : (
                <span style={{color: '#666', fontSize: '13px'}}>
                    {type === 'channel' ? `Channel ${physicalValue}` : `CC${physicalValue}`}
                </span>
            )}
        </div>
    );
};

export default DeviceConfigurationUI;