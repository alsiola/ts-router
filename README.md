# ts-router

[![AI-Agent Readiness](https://ready.kerex.app/api/badge/alsiola/ts-router)](https://ready.kerex.app/analysis/alsiola/ts-router)


This aims to be a type-safe routing layer built over express, making as much use as possible of type inference to prevent double-declaration of e.g. yup validators and interfaces.

## Setup

The main export is `tsRouter`, and it's initial setup is:

```
const createController = tsRouter<TRequest>()({
    injector,
    logger
});
```

where `TRequest` is a request type that *must* extend `express.Request`. This type parameter allows
other parts of your code to depend upon request properties (e.g. req.user) that are managed outside of
`tsRouter`, yet retain a degree of type- safety.

`logger` is a bunyan-compatible logger, used for internal logging of the router (not necessarily the same as injected into resolvers). Usually this already exists in the service, and can be imported from `utils/logger`.

Injectors act to take things from the `request` object, and provide them to your resolvers. All injectors must follow the exported `Injector` type, where `TRequest` is the same request type provided to `tsRouter` previously:

```
interface InjectorCtx {
    controller: string;
    method: string;
    span: Span;
}

export type Injector<TRequest extends Request, TInjected> = (
    req: TRequest,
    ctx: InjectorCtx
) => TInjected;
```

For example, we could provide a logger to all our resolvers which added contextual information about which controller and method were being used. Access to the `request` object allows us to add any information we like to logging context.

```
const injectLogger = (request: Request, { controller, method }) => ({
    logger: {
        log: (msg: string) => console.log({ controller, method }, msg)
    }
});
```

If multiple injectors are needed, the the exported `combineInjectors` function can be used:

```
const createController = tsRouter<TRequest>()({
    injector: combineInjectors(injectLogger, injectSomethingElse)
});
```

## Controllers

A controller groups the implementation of several related endpoints, usually grouped around a particular domain entity, e.g. surveys. We create a controller by calling the `createController` function returned by `tsRouter`:

```
    const router = createController({ controller: "V2Survey", path: "/surveys" });
```

`controller` is a name for this controller, used for logging purposes only. `path` is a "base" URI on which the routes will be mounted, for example, given a controller `path` of `"/surveys"`, a router `path` of `"/:surveyId"` would result in a final URI of `"/surveys/:surveyId"`

This returns a `router`, that can then be used to define specific routes and their implementations.

## Routes

A particular route is created by calling `router.get`, `router.post` etc.

```
    router.post({
        path: "/survey",
        method: "create",
        authorization: requireScopes("create:surveys"),
        middleware: [validator],
        resolver: async ({ body, models: { Survey } }) => {
            const surveyProps = addIdsToSurveyComponents(body);

            const survey = await Survey.create(surveyProps);

            return new Http200(survey);
        }
    });
```

`path` is the URI at which this route will be available - it can contain params, just like a standard express URI.

`method` is a name for this route - it's only used for logging information

`authorization` restricts the access to this route - currently use of `requireScopes` from `@hive/express-authorize` is mandated.

### middleware
Middlewares act essentially as per-route injectors. They take something from the request, ensure it exists in a certain form, then provide it to the resolver with type-safety. They are primarily used at the moment for validation of parts of the request, and must comply with one of the following four types:

```
export type BodyValidator<T> = (
    req: any,
    res: Response,
    next: NextFunction
) => req is { body: T };

export type QueryValidator<T> = (
    req: any,
    res: Response,
    next: NextFunction
) => req is { query: T };

export type ParamsValidator<T> = (
    req: any,
    res: Response,
    next: NextFunction
) => req is { params: T };

export type NoopValidator = (
    req: any,
    res: Response,
    next: NextFunction
) => void;
```

`ts-router` exports some helpers for building validation middleware:

#### `paramsValidator`
Validates that the named params are present, and injects them into the resolver as `{ params: Record<ParamName, string> }`.

```
// Ensure that params contains both "userId" and "surveyId"
const validateParams = paramsValidator("userId", "surveyId");
```

#### yup validators
`yupQueryValidator` and `yupBodyValidator` give a simple way to use `yup` schemas for validation of the query and body of a request respectively. Their usage is the same:

```
const validateBody = yupBodyValidator(yup.object().shape({
    myProperty: yup.string()
}));
```

This would result in the resolver having an injected argument `body` of shape `{ myProperty: string }`.

### Resolvers

Resolvers do the hard work of actually resolving your request. They are provided with injected arguments from both the `tsRouter` `injector`, and the router `middleware`. Additionally, a `logger` and a `span` are always injected, with which further logging/tracing can be performed.

They must return an `HttpResponse` - this interface is fulfilled by the exported classes `Http200`, `Http400` etc. A promise to an `HttpResponse` is also accepted.

If a resolver throws, it will be caught by `ts-router`, and a `500` response returned. In general, it is preferred to *not* throw from resolvers for most errors, but instead to return and `HttpXXX` response representing the most appropriate outcome. For example, a not found error might be raised as:

```
    router.get({
        path: "/survey/:surveyId",
        method: "readById",
        authorization: requireScopes("create:surveys"),
        middleware: [paramsValidator("surveyId")],
        resolver: async ({ body, models: { Survey }, params: { surveyId } }) => {
            const survey = await Survey.findById(surveyId);

            if (!survey) {
                return new Http404("Survey not found");
            }

            return new Http200(survey);
        }
    });
```

## Integrating routes

A controller can be applied to an existing application, e.g.

```
const app = express();

const controller = createController({ controller: "Surveys", path: "/surveys" });

// add routes to controller

controller.apply(app);
```