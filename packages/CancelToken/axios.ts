import axios, {
    AxiosInstance,
    CancelTokenSource,
    AxiosRequestConfig,
} from 'axios';

interface IDispose {
    dispose(): void;
}

type ICancelToken = CancelTokenSource & IDispose;

class CancelTokenFactory implements IDispose {
    static NOOP = () => {};
    private _tokenMap = new Set<ICancelToken>();

    public create(): ICancelToken {
        const source = axios.CancelToken.source();
        let isDisposed = false;
        let isCanceled = false;
        const final = () => {
            this._tokenMap.delete(result);
            result.dispose = result.cancel = CancelTokenFactory.NOOP;
        };
        const result: ICancelToken = {
            token: source.token,
            cancel: (msg?: string) => {
                if (isCanceled || isDisposed) return;
                isCanceled = true;
                source.cancel(msg);
                final();
            },
            dispose() {
                if (isCanceled || isDisposed) return;
                isDisposed = true;
                final();
            },
        };
        this._tokenMap.add(result);
        return result;
    }

    public dispose() {
        if (this._tokenMap.size) {
            this._tokenMap.forEach(source => {
                source.cancel('dispose');
            });
        }
    }
}

interface IWithCancelToken {
    <T = any>(params: AxiosRequestConfig): Promise<T>;
}

type IResolveItem<T> = {
    then: Promise<T>['then'];
    finally: Promise<T>['finally'];
    catch: Promise<T>['catch'];
} & Omit<ICancelToken, 'token'>;

class Core implements IDispose {
    public get = <T = any>(
        url: string,
        params?: AxiosRequestConfig['params'],
        config?: AxiosRequestConfig,
    ) => {
        return this.withCancel<T>(this._instance.request)({
            url,
            ...config,
            params,
            method: 'GET',
        });
    };

    public post = <T = any>(
        url: string,
        data?: AxiosRequestConfig['data'],
        config?: AxiosRequestConfig,
    ) => {
        return this.withCancel<T>(this._instance.request)({
            url,
            ...config,
            data,
            method: 'POST',
        });
    };

    private _unResolvePromise = new Map<string, IResolveItem<any>>();

    constructor(
        private _instance: AxiosInstance,
        public readonly tokenFactory: CancelTokenFactory,
    ) {}

    public withCancel<T>(request: IWithCancelToken) {
        return ({
            cancelToken,
            ...rest
        }: AxiosRequestConfig): IResolveItem<T> => {
            const hash = this._toHash(rest);

            if (this._unResolvePromise.has(hash)) {
                return this._unResolvePromise.get(hash)!;
            }

            const {token, ...other} = this.tokenFactory.create();

            const promise = request<T>({
                ...rest,
                cancelToken: token,
            }).finally(() => {
                if (this._unResolvePromise.has(hash)) {
                    this._unResolvePromise.delete(hash);
                }
                other.dispose();
            });

            const result = {
                then: promise.then.bind(promise),
                finally: promise.finally.bind(promise),
                catch: promise.catch.bind(promise),
                ...other,
            };

            this._unResolvePromise.set(hash, result);

            return result;
        };
    }

    private _toHash(config: AxiosRequestConfig) {
        const {url, params, data} = config;
        const urlSearch = new URLSearchParams({
            ...params,
            ...data,
        });
        urlSearch.sort();
        return `${url}#${urlSearch.toString()}`;
    }

    public dispose() {
        this.tokenFactory.dispose();
    }
}

export const TokenFactory = new CancelTokenFactory();

export function serviceInit(instance: AxiosInstance = axios.create()) {
    return new Core(instance, TokenFactory);
}
