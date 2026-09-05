// Deklarasi minimal (upstream tidak menyertakan tipe untuk modul ini).
export declare const VERSION: string;
export declare class Toolkit {
    [key: string]: any;
}
declare class BaseBuilder {
    constructor(...args: any[]);
    [key: string]: any;
}
export declare class Button extends BaseBuilder {}
export declare class ButtonV2 extends BaseBuilder {}
export declare class Carousel extends BaseBuilder {}
export declare class AIRich extends BaseBuilder {}
export declare class ORich extends AIRich {}
export {};
