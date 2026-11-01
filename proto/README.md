# Sui RPC v2 Protocol Buffers (Vendored)

This directory contains vendored Protocol Buffer definitions required for communicating with the Sui gRPC service (`sui.rpc.v2.LedgerService`) via Tatum's Sui gRPC Gateway (`sui-mainnet-grpc.gateway.tatum.io:443`).

## Upstream Source & Commit
- **Repository:** [MystenLabs/sui-apis](https://github.com/MystenLabs/sui-apis)
- **Branch / Path:** `main` under `proto/`
- **Commit SHA:** `f9015f665a57fb74d050ec33327abbc83b85f804`
- **Commit Date:** 2026-10-31T22:03:26Z

## Service & Proto Definition
- **Main Service:** `sui.rpc.v2.LedgerService` in `sui/rpc/v2/ledger_service.proto`
- **Key RPC Methods:**
  - `GetServiceInfo(GetServiceInfoRequest) returns (GetServiceInfoResponse)`
    - Used to retrieve `chain_id`, `epoch`, `checkpoint_height`, and checkpoint `timestamp`.
  - `GetCheckpoint(GetCheckpointRequest) returns (GetCheckpointResponse)`
    - Used with `sequence_number` to retrieve the checkpoint `digest`.

## Precompiled JSON Descriptor
- **File:** `proto/ledger-service-descriptor.json`
- **Usage:** Used by `@grpc/proto-loader` via `protoLoader.fromJSON()` at runtime to avoid filesystem lookups in serverless / edge environments (such as Vercel).
