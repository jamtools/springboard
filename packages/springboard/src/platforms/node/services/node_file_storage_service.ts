import fs from 'node:fs';

export class NodeFileStorageService {
    saveFile = async (name: string, content: string) => {
        await fs.promises.writeFile(name, content);
    };
}
