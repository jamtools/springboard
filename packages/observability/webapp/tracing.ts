import {diag, DiagConsoleLogger, DiagLogLevel} from '@opentelemetry/api';

import {context, trace, Span, SpanStatusCode} from '@opentelemetry/api';
import {WebTracerProvider, ConsoleSpanExporter} from '@opentelemetry/sdk-trace-web';
import {resourceFromAttributes} from '@opentelemetry/resources';
import {SimpleSpanProcessor} from '@opentelemetry/sdk-trace-base';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {ZoneContextManager} from '@opentelemetry/context-zone';
import {registerInstrumentations} from '@opentelemetry/instrumentation';

const serviceName = 'link-frontend';

const WS_HOST = process.env.WS_HOST;

let TELEMETRY_HOST = '';
if (WS_HOST) {
    const index = WS_HOST.indexOf('://');
    const protocol = WS_HOST.startsWith('wss') ? 'https' : 'http';
    TELEMETRY_HOST = protocol + '://' + WS_HOST.slice(index + 3);
}

const resource = resourceFromAttributes({'service.name': serviceName});

const collector = new OTLPTraceExporter({
    url: `${TELEMETRY_HOST}/v1/traces`,
});

const provider = new WebTracerProvider({
    resource,
    spanProcessors: [
        new SimpleSpanProcessor(collector),
        new SimpleSpanProcessor(new ConsoleSpanExporter()),
    ],
});
provider.register({contextManager: new ZoneContextManager()});

const webTracerWithZone = provider.getTracer(serviceName);

declare const window: any;
var bindingSpan: Span | undefined;

window.startBindingSpan = (
    traceId: string,
    spanId: string,
    traceFlags: number
) => {
    bindingSpan = webTracerWithZone.startSpan('');
    bindingSpan.spanContext().traceId = traceId;
    bindingSpan.spanContext().spanId = spanId;
    bindingSpan.spanContext().traceFlags = traceFlags;
};

// Optional: Enable diagnostics for debugging
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);


registerInstrumentations({
    instrumentations: [],
});

export function traceSpan<F extends (...args: any) => ReturnType<F>>(
    name: string,
    func: F
): ReturnType<F> {
    var singleSpan: Span;
    if (bindingSpan) {
        const ctx = trace.setSpan(context.active(), bindingSpan);
        singleSpan = webTracerWithZone.startSpan(name, undefined, ctx);
        bindingSpan = undefined;
    } else {
        singleSpan = webTracerWithZone.startSpan(name);
    }
    return context.with(trace.setSpan(context.active(), singleSpan), () => {
        try {
            const result = func();
            singleSpan.end();
            return result;
        } catch (error) {
            singleSpan.setStatus({code: SpanStatusCode.ERROR});
            singleSpan.end();
            throw error;
        }
    });
}

const handleError = (message: any, source: any, lineno: any, colno: any, error: any) => {
    // alert(message);
    const activeSpan = provider.getTracer('default').startSpan('uncaught_error', {
        attributes: {
            message,
            source,
            lineno,
            colno,
        },
    });

    activeSpan.recordException(error);
    activeSpan.setStatus({code: 2, message: error.message});

    activeSpan.end();
};

window.onerror = (message: any, source: any, lineno: any, colno: any, error: any) => {
    handleError(message, source, lineno, colno, error);
};

window.addEventListener('unhandledrejection', function (e: {reason: Error}) {
    handleError(e.reason.message, e.reason.stack, '', '', e.reason);
})
