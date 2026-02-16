# Method

Use this repository as a definition-and-contract gate, not an implementation workspace.

## In-scope sequence

1. Decompose into components
2. Define program intent and economics (`program.definition.ts`)
3. Define program graph and determinism policy (`program.contract.ts`)
4. Define component interfaces and behavior (`components/*/contract.ts` + `components/*/spec.md`)
5. Iterate contract fit until consistent end-to-end

## Out of scope for now

- Test vector authoring
- Component implementation
- Runtime integration
- End-to-end verification

## Minimum quality bar

- Every component has a clear bounded responsibility
- Every boundary type is explicit and versioned
- Program contract is fully derivable from program definition
- Component contracts/specs are fully derivable from program contract
- Determinism assumptions are explicit and stable
