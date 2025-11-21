import React from 'react';

import springboard from 'springboard';
import {ModuleAPI} from 'springboard/engine/module_api';
import {IndexedDbFileStorageProvider} from './file_storage_providers/indexed_db_file_storage_provider';
import {FileInfo} from './file_types';

declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        Files: FilesModule;
    }
}

type FileUploadOptions = {

};

type FileUploadAction<T extends object = {}> = (file: File, args: T) => Promise<UploadSupervisor>;

type CreateFileUploadAction = <T extends object = {}>(
    modAPI: ModuleAPI,
    actionName: string,
    options: FileUploadOptions,
    callback: (fileInfo: FileInfo, args: T) => void
) => FileUploadAction<T>;

type UploadSupervisor = {
    progressSubject: any;
    components: {
        Progress: React.ElementType;
    };
};

type FilesModule = {
    uploadFile: (file: File) => Promise<FileInfo>;
    createFileUploadAction: CreateFileUploadAction;
    deleteFile: (fileId: string) => Promise<void>;
    getFileSrc: (fileId: string) => Promise<string>;
    listFiles: () => FileInfo[];
    useFiles: () => FileInfo[];
}

springboard.registerModule('Files', {}, async (moduleAPI): Promise<FilesModule> => {
    const sharedStates = await moduleAPI.shared.createSharedStates({
        allStoredFiles: [] as FileInfo[]
    });

    const fileUploader = new IndexedDbFileStorageProvider();
    await fileUploader.initialize();

    const uploadFile = async (file: File): Promise<FileInfo> => {
        const fileInfo = await fileUploader.uploadFile(file);
        sharedStates.allStoredFiles.setState((files: FileInfo[]) => [...files, fileInfo]);
        return fileInfo;
    };

    const createFileUploadAction = <T extends object,>(
        modAPI: ModuleAPI,
        actionName: string,
        options: FileUploadOptions,
        callback: (fileInfo: FileInfo, args: T) => void
    ): any => {
        return async (file: File, args: T) => {
            const fileInfo = await fileUploader.uploadFile(file);
            sharedStates.allStoredFiles.setState((files: FileInfo[]) => [...files, fileInfo]);

            callback(fileInfo, args);
            // return fileUploader.uploadFile(modAPI, file, args, actionName, options);
        };
    };

    const deleteFile = async (fileId: string) => {
        await fileUploader.deleteFile(fileId);
        sharedStates.allStoredFiles.setState((files: FileInfo[]) => {
            const index = files.findIndex((f: FileInfo) => f.id === fileId)!;
            return [
                ...files.slice(0, index),
                ...files.slice(index + 1),
            ];
        });
    };

    return {
        uploadFile,
        createFileUploadAction,
        deleteFile,
        getFileSrc: fileUploader.getFileContent,
        listFiles: sharedStates.allStoredFiles.getState,
        useFiles: sharedStates.allStoredFiles.useState,
    };
});
