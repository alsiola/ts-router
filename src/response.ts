export interface HttpResponse<T> {
    code: number;
    content: T;
}

export class Http200<T> implements HttpResponse<T> {
    public code = 200;
    constructor(public content: T) {}
}

export class Http400<T> implements HttpResponse<T> {
    public code = 400;
    constructor(public content: T) {}
}

export class Http404<T> implements HttpResponse<T> {
    public code = 404;
    constructor(public content: T) {}
}

export class Http410<T> implements HttpResponse<T> {
    public code = 410;
    constructor(public content: T) {}
}

export class Http500<T> implements HttpResponse<T> {
    public code = 500;
    constructor(public content: T) {}
}
