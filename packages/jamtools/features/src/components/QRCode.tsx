import React from 'react';

import QRCodeLibrary from 'qrcode';

type Props = {
    url: string;
    style: React.CSSProperties;
}

export const QRCode = (props: Props) => {
    React.useEffect(() => {
        QRCodeLibrary.toCanvas(document.getElementById('qr-canvas'), props.url, {
            scale: 8
        });
    }, []);

    return (
        <canvas
            id='qr-canvas'
            style={props.style}
            width={'100%'}
        />
    );
};
