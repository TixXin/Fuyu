export declare class FsError extends Error {
    code: FsError.Code;
    url: URL;
    name: string;
    constructor(code: FsError.Code, url: URL, message: string);
}
export declare namespace FsError {
    type Code = 
    /** No provider is mounted for the location. */
    'NoProvider'
    /** The provider of the location does not implement the operation. */
     | 'NotSupported';
}
