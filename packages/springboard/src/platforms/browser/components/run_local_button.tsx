import React from 'react';

const isLocal = localStorage.getItem('isLocal') === 'true';

export const RunLocalButton = () => {
    const labelToDisplay = isLocal ? 'Playing locally' : 'Connected to remote';

    const onClick = () => {
        if (isLocal) {
            if (confirm('Connect to remote server?')) {
                localStorage.removeItem('isLocal');
                location.reload();
            }
        } else {
            if (confirm('Run locally?')) {
                localStorage.setItem('isLocal', 'true');
                location.reload();
            }
        }
    };

    return (
        <button onClick={onClick}>
            {labelToDisplay}
        </button>
    );
};
