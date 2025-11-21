import React from 'react';

import springboard from 'springboard';

const CustomSplashScreen = () => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#f0f0f0',
            fontFamily: 'Arial, sans-serif'
        }}>
            <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#333',
                marginBottom: '20px'
            }}>
                🚀 Loading Awesome App
            </div>
            <div style={{
                width: '200px',
                height: '4px',
                backgroundColor: '#ddd',
                borderRadius: '2px',
                overflow: 'hidden'
            }}>
                <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#007acc',
                    borderRadius: '2px',
                    animation: 'loading 1.5s ease-in-out infinite'
                }}></div>
            </div>
            <style>{`
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(0%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

springboard.registerSplashScreen(CustomSplashScreen);

springboard.registerModule('AppWithSplashScreen', {}, async (moduleAPI) => {
    const states = await moduleAPI.shared.createSharedStates({
        message: 'Hello from the app with custom splash screen!',
    });
    const messageState = states.message;

    await new Promise(r => setTimeout(r, 5000)); // fake waiting time

    const actions = moduleAPI.createActions({
        updateMessage: async (args: {newMessage: string}) => {
            messageState.setState(args.newMessage);
        },
    });

    moduleAPI.registerRoute('/', {}, () => {
        return (
            <AppWithSplashScreenComponent
                message={messageState.useState()}
                updateMessage={actions.updateMessage}
            />
        );
    });
});

type AppWithSplashScreenComponentProps = {
    message: string;
    updateMessage: (args: {newMessage: string}) => void;
};

const AppWithSplashScreenComponent = (props: AppWithSplashScreenComponentProps) => {
    const [inputValue, setInputValue] = React.useState('');

    return (
        <div style={{
            padding: '20px',
            fontFamily: 'Arial, sans-serif',
            maxWidth: '600px',
            margin: '0 auto'
        }}>
            <h1 style={{
                color: '#333',
                textAlign: 'center'
            }}>
                App with Custom Splash Screen
            </h1>

            <div style={{
                backgroundColor: '#f9f9f9',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #ddd'
            }}>
                <h2>Current Message:</h2>
                <p style={{
                    fontSize: '18px',
                    fontStyle: 'italic',
                    color: '#007acc'
                }}>
                    {props.message}
                </p>
            </div>

            <div>
                <h3>Update Message:</h3>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Enter new message..."
                    style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '16px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        marginBottom: '10px'
                    }}
                />
                <button
                    onClick={() => {
                        props.updateMessage({newMessage: inputValue});
                        setInputValue('');
                    }}
                    style={{
                        backgroundColor: '#007acc',
                        color: 'white',
                        padding: '10px 20px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '16px',
                        cursor: 'pointer'
                    }}
                >
                    Update Message
                </button>
            </div>

            <div style={{
                marginTop: '30px',
                padding: '15px',
                backgroundColor: '#e8f4fd',
                borderRadius: '8px',
                border: '1px solid #007acc'
            }}>
                <h3>About this app:</h3>
                <p>This app demonstrates the custom splash screen functionality. When the app loads, you should see a custom animated splash screen instead of the default "Loading..." text.</p>
            </div>
        </div>
    );
};
