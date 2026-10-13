import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Ballot = { round: bigint; candidate: Uint8Array };

export enum Phase { ACTIVE = 0, SUNSET = 1 }

export type Passbook = { shares: bigint;
                         socialFund: bigint;
                         loanOutstanding: bigint
                       };

export type Entry = { shares: bigint;
                      socialFund: bigint;
                      loanIssued: bigint;
                      loanRepaid: bigint
                    };

export type Witnesses<PS> = {
  localSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  groupSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  passbookOf(context: __compactRuntime.WitnessContext<Ledger, PS>,
             slot_0: bigint): [PS, Passbook];
}

export type ImpureCircuits<PS> = {
  recordMeeting(context: __compactRuntime.CircuitContext<PS>,
                page_0: bigint,
                entries_0: Entry[]): __compactRuntime.CircuitResults<PS, []>;
  attestSavings(context: __compactRuntime.CircuitContext<PS>,
                slot_0: bigint,
                minShares_0: bigint,
                nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  addMember(context: __compactRuntime.CircuitContext<PS>,
            memberKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  handoverSecretary(context: __compactRuntime.CircuitContext<PS>,
                    newSecretary_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  adminReplaceSecretary(context: __compactRuntime.CircuitContext<PS>,
                        newSecretary_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  voteSecretary(context: __compactRuntime.CircuitContext<PS>,
                slot_0: bigint,
                candidate_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  heartbeat(context: __compactRuntime.CircuitContext<PS>, now_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  sunset(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  rotateFeeKey(context: __compactRuntime.CircuitContext<PS>,
               newFeeKeyTag_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  recordMeeting(context: __compactRuntime.CircuitContext<PS>,
                page_0: bigint,
                entries_0: Entry[]): __compactRuntime.CircuitResults<PS, []>;
  attestSavings(context: __compactRuntime.CircuitContext<PS>,
                slot_0: bigint,
                minShares_0: bigint,
                nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  addMember(context: __compactRuntime.CircuitContext<PS>,
            memberKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  handoverSecretary(context: __compactRuntime.CircuitContext<PS>,
                    newSecretary_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  adminReplaceSecretary(context: __compactRuntime.CircuitContext<PS>,
                        newSecretary_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  voteSecretary(context: __compactRuntime.CircuitContext<PS>,
                slot_0: bigint,
                candidate_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  heartbeat(context: __compactRuntime.CircuitContext<PS>, now_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  sunset(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  rotateFeeKey(context: __compactRuntime.CircuitContext<PS>,
               newFeeKeyTag_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  roleKey(domain_0: Uint8Array, sk_0: Uint8Array): Uint8Array;
  passbookSalt(gs_0: Uint8Array, slot_0: bigint, version_0: bigint): bigint;
  passbookCommitment(pb_0: Passbook,
                     gs_0: Uint8Array,
                     slot_0: bigint,
                     version_0: bigint): bigint;
  attestationId(nonce_0: Uint8Array): Uint8Array;
  ballotId(round_0: bigint, candidate_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  roleKey(context: __compactRuntime.CircuitContext<PS>,
          domain_0: Uint8Array,
          sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  passbookSalt(context: __compactRuntime.CircuitContext<PS>,
               gs_0: Uint8Array,
               slot_0: bigint,
               version_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  passbookCommitment(context: __compactRuntime.CircuitContext<PS>,
                     pb_0: Passbook,
                     gs_0: Uint8Array,
                     slot_0: bigint,
                     version_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  attestationId(context: __compactRuntime.CircuitContext<PS>,
                nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  ballotId(context: __compactRuntime.CircuitContext<PS>,
           round_0: bigint,
           candidate_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  recordMeeting(context: __compactRuntime.CircuitContext<PS>,
                page_0: bigint,
                entries_0: Entry[]): __compactRuntime.CircuitResults<PS, []>;
  attestSavings(context: __compactRuntime.CircuitContext<PS>,
                slot_0: bigint,
                minShares_0: bigint,
                nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  addMember(context: __compactRuntime.CircuitContext<PS>,
            memberKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  handoverSecretary(context: __compactRuntime.CircuitContext<PS>,
                    newSecretary_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  adminReplaceSecretary(context: __compactRuntime.CircuitContext<PS>,
                        newSecretary_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  voteSecretary(context: __compactRuntime.CircuitContext<PS>,
                slot_0: bigint,
                candidate_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  heartbeat(context: __compactRuntime.CircuitContext<PS>, now_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  sunset(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  rotateFeeKey(context: __compactRuntime.CircuitContext<PS>,
               newFeeKeyTag_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly memberCount: bigint;
  memberKeys: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  passbooks: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): bigint;
    [Symbol.iterator](): Iterator<[bigint, bigint]>
  };
  passbookVersion: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): bigint;
    [Symbol.iterator](): Iterator<[bigint, bigint]>
  };
  readonly secretaryKey: Uint8Array;
  readonly maintainerKey: Uint8Array;
  readonly groupKeyTag: Uint8Array;
  readonly meetings: bigint;
  readonly lastHeartbeat: bigint;
  readonly graceSeconds: bigint;
  readonly phase: Phase;
  readonly feeKeyEpoch: bigint;
  readonly feeKeyTag: Uint8Array;
  attestations: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  readonly recoveryRound: bigint;
  recoveryVotes: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  recoveryTally: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               initialMembers_0: Uint8Array[],
               count_0: bigint,
               secretary_0: Uint8Array,
               maintainer_0: Uint8Array,
               groupTag_0: Uint8Array,
               firstFeeKeyTag_0: Uint8Array,
               grace_0: bigint,
               startTime_0: bigint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
