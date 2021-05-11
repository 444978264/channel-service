import {IDispose} from '../utils/event';
export abstract class Service implements IDispose {
    constructor() {}
    abstract call(name: string): Promise<any>;
    abstract dispose(): void;
}
export interface IServiceManager {
    on(channel: string): void;
    removeListener(channel: string, listener: () => void): void;
}

export class ServiceManager {
    private static services = new Map<string, Service>();
    public static register(name: string, service: Service): void {
        if (ServiceManager.services.has(name)) {
            throw Error(
                `the service name (${name}) already existed; please change another one`,
            );
        }
        ServiceManager.services.set(name, service);
    }
    constructor(private _adapter: IServiceManager) {}
}
