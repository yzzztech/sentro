// Minimal OTLP trace proto schema embedded as protobufjs JSON descriptor.
// Only the fields Sentro's translator reads are defined — keep it tight to minimize
// decode cost. Field numbers and wire types match opentelemetry-proto v1.3.2.
// https://github.com/open-telemetry/opentelemetry-proto/blob/v1.3.2/opentelemetry/proto/trace/v1/trace.proto
export const otlpTraceSchema = {
  nested: {
    opentelemetry: {
      nested: {
        proto: {
          nested: {
            common: {
              nested: {
                v1: {
                  nested: {
                    AnyValue: {
                      oneofs: { value: { oneof: ["stringValue", "boolValue", "intValue", "doubleValue", "arrayValue", "kvlistValue", "bytesValue"] } },
                      fields: {
                        stringValue: { type: "string", id: 1 },
                        boolValue: { type: "bool", id: 2 },
                        intValue: { type: "sint64", id: 3 },
                        doubleValue: { type: "double", id: 4 },
                        arrayValue: { type: "ArrayValue", id: 5 },
                        kvlistValue: { type: "KeyValueList", id: 6 },
                        bytesValue: { type: "bytes", id: 7 },
                      },
                    },
                    ArrayValue: { fields: { values: { rule: "repeated", type: "AnyValue", id: 1 } } },
                    KeyValueList: { fields: { values: { rule: "repeated", type: "KeyValue", id: 1 } } },
                    KeyValue: {
                      fields: {
                        key: { type: "string", id: 1 },
                        value: { type: "AnyValue", id: 2 },
                      },
                    },
                    InstrumentationScope: {
                      fields: {
                        name: { type: "string", id: 1 },
                        version: { type: "string", id: 2 },
                      },
                    },
                  },
                },
              },
            },
            resource: {
              nested: {
                v1: {
                  nested: {
                    Resource: {
                      fields: {
                        attributes: { rule: "repeated", type: "opentelemetry.proto.common.v1.KeyValue", id: 1 },
                      },
                    },
                  },
                },
              },
            },
            trace: {
              nested: {
                v1: {
                  nested: {
                    TracesData: {
                      fields: {
                        resourceSpans: { rule: "repeated", type: "ResourceSpans", id: 1 },
                      },
                    },
                    ResourceSpans: {
                      fields: {
                        resource: { type: "opentelemetry.proto.resource.v1.Resource", id: 1 },
                        scopeSpans: { rule: "repeated", type: "ScopeSpans", id: 2 },
                        schemaUrl: { type: "string", id: 3 },
                      },
                    },
                    ScopeSpans: {
                      fields: {
                        scope: { type: "opentelemetry.proto.common.v1.InstrumentationScope", id: 1 },
                        spans: { rule: "repeated", type: "Span", id: 2 },
                        schemaUrl: { type: "string", id: 3 },
                      },
                    },
                    Span: {
                      fields: {
                        traceId: { type: "bytes", id: 1 },
                        spanId: { type: "bytes", id: 2 },
                        traceState: { type: "string", id: 3 },
                        parentSpanId: { type: "bytes", id: 4 },
                        name: { type: "string", id: 5 },
                        kind: { type: "int32", id: 6 },
                        startTimeUnixNano: { type: "fixed64", id: 7 },
                        endTimeUnixNano: { type: "fixed64", id: 8 },
                        attributes: { rule: "repeated", type: "opentelemetry.proto.common.v1.KeyValue", id: 9 },
                        status: { type: "Status", id: 15 },
                      },
                    },
                    Status: {
                      fields: {
                        message: { type: "string", id: 2 },
                        code: { type: "int32", id: 3 },
                      },
                    },
                  },
                },
              },
            },
            collector: {
              nested: {
                trace: {
                  nested: {
                    v1: {
                      nested: {
                        ExportTraceServiceRequest: {
                          fields: {
                            resourceSpans: {
                              rule: "repeated",
                              type: "opentelemetry.proto.trace.v1.ResourceSpans",
                              id: 1,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
