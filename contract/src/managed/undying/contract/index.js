import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.16.0');

export var Phase;
(function (Phase) {
  Phase[Phase['ACTIVE'] = 0] = 'ACTIVE';
  Phase[Phase['SUNSET'] = 1] = 'SUNSET';
})(Phase || (Phase = {}));

const _descriptor_0 = new __compactRuntime.CompactTypeEnum(1, 1);

const _descriptor_1 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_2 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

const _descriptor_3 = new __compactRuntime.CompactTypeUnsignedInteger(65535n, 2);

const _descriptor_4 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

const _descriptor_5 = new __compactRuntime.CompactTypeUnsignedInteger(4294967295n, 4);

const _descriptor_6 = __compactRuntime.CompactTypeField;

const _descriptor_7 = new __compactRuntime.CompactTypeUnsignedInteger(1n, 1);

class _Entry_0 {
  alignment() {
    return _descriptor_3.alignment().concat(_descriptor_3.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment())));
  }
  fromValue(value_0) {
    return {
      shares: _descriptor_3.fromValue(value_0),
      socialFund: _descriptor_3.fromValue(value_0),
      loanIssued: _descriptor_5.fromValue(value_0),
      loanRepaid: _descriptor_5.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_3.toValue(value_0.shares).concat(_descriptor_3.toValue(value_0.socialFund).concat(_descriptor_5.toValue(value_0.loanIssued).concat(_descriptor_5.toValue(value_0.loanRepaid))));
  }
}

const _descriptor_8 = new _Entry_0();

const _descriptor_9 = new __compactRuntime.CompactTypeVector(5, _descriptor_8);

class _Passbook_0 {
  alignment() {
    return _descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment()));
  }
  fromValue(value_0) {
    return {
      shares: _descriptor_5.fromValue(value_0),
      socialFund: _descriptor_5.fromValue(value_0),
      loanOutstanding: _descriptor_5.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_5.toValue(value_0.shares).concat(_descriptor_5.toValue(value_0.socialFund).concat(_descriptor_5.toValue(value_0.loanOutstanding)));
  }
}

const _descriptor_10 = new _Passbook_0();

const _descriptor_11 = new __compactRuntime.CompactTypeVector(2, _descriptor_1);

const _descriptor_12 = __compactRuntime.CompactTypeBoolean;

const _descriptor_13 = new __compactRuntime.CompactTypeVector(3, _descriptor_6);

class _Either_0 {
  alignment() {
    return _descriptor_12.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_12.fromValue(value_0),
      left: _descriptor_1.fromValue(value_0),
      right: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_12.toValue(value_0.is_left).concat(_descriptor_1.toValue(value_0.left).concat(_descriptor_1.toValue(value_0.right)));
  }
}

const _descriptor_14 = new _Either_0();

const _descriptor_15 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_1.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.bytes);
  }
}

const _descriptor_16 = new _ContractAddress_0();

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.localSecret) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named localSecret');
    }
    if (typeof(witnesses_0.groupSecret) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named groupSecret');
    }
    if (typeof(witnesses_0.passbookOf) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named passbookOf');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      roleKey(context, ...args_1) {
        return { result: pureCircuits.roleKey(...args_1), context };
      },
      passbookSalt(context, ...args_1) {
        return { result: pureCircuits.passbookSalt(...args_1), context };
      },
      passbookCommitment(context, ...args_1) {
        return { result: pureCircuits.passbookCommitment(...args_1), context };
      },
      attestationId(context, ...args_1) {
        return { result: pureCircuits.attestationId(...args_1), context };
      },
      recordMeeting: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`recordMeeting: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const page_0 = args_1[1];
        const entries_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('recordMeeting',
                                     'argument 1 (as invoked from Typescript)',
                                     'undying.compact line 160 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(page_0) === 'bigint' && page_0 >= 0n && page_0 <= 1n)) {
          __compactRuntime.typeError('recordMeeting',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'undying.compact line 160 char 1',
                                     'Uint<0..2>',
                                     page_0)
        }
        if (!(Array.isArray(entries_0) && entries_0.length === 5 && entries_0.every((t) => typeof(t) === 'object' && typeof(t.shares) === 'bigint' && t.shares >= 0n && t.shares <= 65535n && typeof(t.socialFund) === 'bigint' && t.socialFund >= 0n && t.socialFund <= 65535n && typeof(t.loanIssued) === 'bigint' && t.loanIssued >= 0n && t.loanIssued <= 4294967295n && typeof(t.loanRepaid) === 'bigint' && t.loanRepaid >= 0n && t.loanRepaid <= 4294967295n))) {
          __compactRuntime.typeError('recordMeeting',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'undying.compact line 160 char 1',
                                     'Vector<5, struct Entry<shares: Uint<0..65536>, socialFund: Uint<0..65536>, loanIssued: Uint<0..4294967296>, loanRepaid: Uint<0..4294967296>>>',
                                     entries_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_7.toValue(page_0).concat(_descriptor_9.toValue(entries_0)),
            alignment: _descriptor_7.alignment().concat(_descriptor_9.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._recordMeeting_0(context,
                                               partialProofData,
                                               page_0,
                                               entries_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      attestSavings: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`attestSavings: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const slot_0 = args_1[1];
        const minShares_0 = args_1[2];
        const nonce_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('attestSavings',
                                     'argument 1 (as invoked from Typescript)',
                                     'undying.compact line 189 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(slot_0) === 'bigint' && slot_0 >= 0n && slot_0 <= 255n)) {
          __compactRuntime.typeError('attestSavings',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'undying.compact line 189 char 1',
                                     'Uint<0..256>',
                                     slot_0)
        }
        if (!(typeof(minShares_0) === 'bigint' && minShares_0 >= 0n && minShares_0 <= 4294967295n)) {
          __compactRuntime.typeError('attestSavings',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'undying.compact line 189 char 1',
                                     'Uint<0..4294967296>',
                                     minShares_0)
        }
        if (!(nonce_0.buffer instanceof ArrayBuffer && nonce_0.BYTES_PER_ELEMENT === 1 && nonce_0.length === 32)) {
          __compactRuntime.typeError('attestSavings',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'undying.compact line 189 char 1',
                                     'Bytes<32>',
                                     nonce_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_4.toValue(slot_0).concat(_descriptor_5.toValue(minShares_0).concat(_descriptor_1.toValue(nonce_0))),
            alignment: _descriptor_4.alignment().concat(_descriptor_5.alignment().concat(_descriptor_1.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._attestSavings_0(context,
                                               partialProofData,
                                               slot_0,
                                               minShares_0,
                                               nonce_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      addMember: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`addMember: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const memberKey_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('addMember',
                                     'argument 1 (as invoked from Typescript)',
                                     'undying.compact line 201 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(memberKey_0.buffer instanceof ArrayBuffer && memberKey_0.BYTES_PER_ELEMENT === 1 && memberKey_0.length === 32)) {
          __compactRuntime.typeError('addMember',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'undying.compact line 201 char 1',
                                     'Bytes<32>',
                                     memberKey_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(memberKey_0),
            alignment: _descriptor_1.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._addMember_0(context,
                                           partialProofData,
                                           memberKey_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      handoverSecretary: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`handoverSecretary: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const newSecretary_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('handoverSecretary',
                                     'argument 1 (as invoked from Typescript)',
                                     'undying.compact line 210 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(newSecretary_0.buffer instanceof ArrayBuffer && newSecretary_0.BYTES_PER_ELEMENT === 1 && newSecretary_0.length === 32)) {
          __compactRuntime.typeError('handoverSecretary',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'undying.compact line 210 char 1',
                                     'Bytes<32>',
                                     newSecretary_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(newSecretary_0),
            alignment: _descriptor_1.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._handoverSecretary_0(context,
                                                   partialProofData,
                                                   newSecretary_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      adminReplaceSecretary: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`adminReplaceSecretary: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const newSecretary_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('adminReplaceSecretary',
                                     'argument 1 (as invoked from Typescript)',
                                     'undying.compact line 217 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(newSecretary_0.buffer instanceof ArrayBuffer && newSecretary_0.BYTES_PER_ELEMENT === 1 && newSecretary_0.length === 32)) {
          __compactRuntime.typeError('adminReplaceSecretary',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'undying.compact line 217 char 1',
                                     'Bytes<32>',
                                     newSecretary_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(newSecretary_0),
            alignment: _descriptor_1.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._adminReplaceSecretary_0(context,
                                                       partialProofData,
                                                       newSecretary_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      heartbeat: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`heartbeat: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const now_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('heartbeat',
                                     'argument 1 (as invoked from Typescript)',
                                     'undying.compact line 226 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(now_0) === 'bigint' && now_0 >= 0n && now_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('heartbeat',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'undying.compact line 226 char 1',
                                     'Uint<0..18446744073709551616>',
                                     now_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_2.toValue(now_0),
            alignment: _descriptor_2.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._heartbeat_0(context, partialProofData, now_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      sunset: (...args_1) => {
        if (args_1.length !== 1) {
          throw new __compactRuntime.CompactError(`sunset: expected 1 argument (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('sunset',
                                     'argument 1 (as invoked from Typescript)',
                                     'undying.compact line 236 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: { value: [], alignment: [] },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._sunset_0(context, partialProofData);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      rotateFeeKey: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`rotateFeeKey: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const newFeeKeyTag_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('rotateFeeKey',
                                     'argument 1 (as invoked from Typescript)',
                                     'undying.compact line 249 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(newFeeKeyTag_0.buffer instanceof ArrayBuffer && newFeeKeyTag_0.BYTES_PER_ELEMENT === 1 && newFeeKeyTag_0.length === 32)) {
          __compactRuntime.typeError('rotateFeeKey',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'undying.compact line 249 char 1',
                                     'Bytes<32>',
                                     newFeeKeyTag_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(newFeeKeyTag_0),
            alignment: _descriptor_1.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._rotateFeeKey_0(context,
                                              partialProofData,
                                              newFeeKeyTag_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      }
    };
    this.impureCircuits = {
      recordMeeting: this.circuits.recordMeeting,
      attestSavings: this.circuits.attestSavings,
      addMember: this.circuits.addMember,
      handoverSecretary: this.circuits.handoverSecretary,
      adminReplaceSecretary: this.circuits.adminReplaceSecretary,
      heartbeat: this.circuits.heartbeat,
      sunset: this.circuits.sunset,
      rotateFeeKey: this.circuits.rotateFeeKey
    };
    this.provableCircuits = {
      recordMeeting: this.circuits.recordMeeting,
      attestSavings: this.circuits.attestSavings,
      addMember: this.circuits.addMember,
      handoverSecretary: this.circuits.handoverSecretary,
      adminReplaceSecretary: this.circuits.adminReplaceSecretary,
      heartbeat: this.circuits.heartbeat,
      sunset: this.circuits.sunset,
      rotateFeeKey: this.circuits.rotateFeeKey
    };
  }
  initialState(...args_0) {
    if (args_0.length !== 9) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 9 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    const initialMembers_0 = args_0[1];
    const count_0 = args_0[2];
    const secretary_0 = args_0[3];
    const maintainer_0 = args_0[4];
    const groupTag_0 = args_0[5];
    const firstFeeKeyTag_0 = args_0[6];
    const grace_0 = args_0[7];
    const startTime_0 = args_0[8];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!(Array.isArray(initialMembers_0) && initialMembers_0.length === 10 && initialMembers_0.every((t) => t.buffer instanceof ArrayBuffer && t.BYTES_PER_ELEMENT === 1 && t.length === 32))) {
      __compactRuntime.typeError('Contract state constructor',
                                 'argument 1 (argument 2 as invoked from Typescript)',
                                 'undying.compact line 122 char 1',
                                 'Vector<10, Bytes<32>>',
                                 initialMembers_0)
    }
    if (!(typeof(count_0) === 'bigint' && count_0 >= 0n && count_0 <= 255n)) {
      __compactRuntime.typeError('Contract state constructor',
                                 'argument 2 (argument 3 as invoked from Typescript)',
                                 'undying.compact line 122 char 1',
                                 'Uint<0..256>',
                                 count_0)
    }
    if (!(secretary_0.buffer instanceof ArrayBuffer && secretary_0.BYTES_PER_ELEMENT === 1 && secretary_0.length === 32)) {
      __compactRuntime.typeError('Contract state constructor',
                                 'argument 3 (argument 4 as invoked from Typescript)',
                                 'undying.compact line 122 char 1',
                                 'Bytes<32>',
                                 secretary_0)
    }
    if (!(maintainer_0.buffer instanceof ArrayBuffer && maintainer_0.BYTES_PER_ELEMENT === 1 && maintainer_0.length === 32)) {
      __compactRuntime.typeError('Contract state constructor',
                                 'argument 4 (argument 5 as invoked from Typescript)',
                                 'undying.compact line 122 char 1',
                                 'Bytes<32>',
                                 maintainer_0)
    }
    if (!(groupTag_0.buffer instanceof ArrayBuffer && groupTag_0.BYTES_PER_ELEMENT === 1 && groupTag_0.length === 32)) {
      __compactRuntime.typeError('Contract state constructor',
                                 'argument 5 (argument 6 as invoked from Typescript)',
                                 'undying.compact line 122 char 1',
                                 'Bytes<32>',
                                 groupTag_0)
    }
    if (!(firstFeeKeyTag_0.buffer instanceof ArrayBuffer && firstFeeKeyTag_0.BYTES_PER_ELEMENT === 1 && firstFeeKeyTag_0.length === 32)) {
      __compactRuntime.typeError('Contract state constructor',
                                 'argument 6 (argument 7 as invoked from Typescript)',
                                 'undying.compact line 122 char 1',
                                 'Bytes<32>',
                                 firstFeeKeyTag_0)
    }
    if (!(typeof(grace_0) === 'bigint' && grace_0 >= 0n && grace_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('Contract state constructor',
                                 'argument 7 (argument 8 as invoked from Typescript)',
                                 'undying.compact line 122 char 1',
                                 'Uint<0..18446744073709551616>',
                                 grace_0)
    }
    if (!(typeof(startTime_0) === 'bigint' && startTime_0 >= 0n && startTime_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('Contract state constructor',
                                 'argument 8 (argument 9 as invoked from Typescript)',
                                 'undying.compact line 122 char 1',
                                 'Uint<0..18446744073709551616>',
                                 startTime_0)
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('recordMeeting', new __compactRuntime.ContractOperation());
    state_0.setOperation('attestSavings', new __compactRuntime.ContractOperation());
    state_0.setOperation('addMember', new __compactRuntime.ContractOperation());
    state_0.setOperation('handoverSecretary', new __compactRuntime.ContractOperation());
    state_0.setOperation('adminReplaceSecretary', new __compactRuntime.ContractOperation());
    state_0.setOperation('heartbeat', new __compactRuntime.ContractOperation());
    state_0.setOperation('sunset', new __compactRuntime.ContractOperation());
    state_0.setOperation('rotateFeeKey', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(0n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(0n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(1n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(2n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(3n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(4n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(5n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(6n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(7n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(8n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(9n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(10n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(11n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(12n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(13n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.assert(count_0 <= 10n, 'At most 10 members in this version');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(0n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(count_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(4n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(secretary_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(5n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(maintainer_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(6n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(groupTag_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(12n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(firstFeeKeyTag_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_4.toValue(11n),
                                                                  alignment: _descriptor_4.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_3.toValue(tmp_0),
                                                                alignment: _descriptor_3.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(9n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(grace_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(8n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(startTime_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(10n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const gs_0 = this._checkedGroupSecret_0(context, partialProofData);
    const zero_0 = { shares: 0n, socialFund: 0n, loanOutstanding: 0n };
    this._folder_0(context,
                   partialProofData,
                   ((context, partialProofData, t_0, i_0) =>
                    {
                      const slot_0 = i_0;
                      if (slot_0
                          <
                          _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                    partialProofData,
                                                                                    [
                                                                                     { dup: { n: 0 } },
                                                                                     { idx: { cached: false,
                                                                                              pushPath: false,
                                                                                              path: [
                                                                                                     { tag: 'value',
                                                                                                       value: { value: _descriptor_4.toValue(0n),
                                                                                                                alignment: _descriptor_4.alignment() } }] } },
                                                                                     { popeq: { cached: false,
                                                                                                result: undefined } }]).value))
                      {
                        const tmp_1 = initialMembers_0[i_0];
                        __compactRuntime.queryLedgerState(context,
                                                          partialProofData,
                                                          [
                                                           { idx: { cached: false,
                                                                    pushPath: true,
                                                                    path: [
                                                                           { tag: 'value',
                                                                             value: { value: _descriptor_4.toValue(1n),
                                                                                      alignment: _descriptor_4.alignment() } }] } },
                                                           { push: { storage: false,
                                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(slot_0),
                                                                                                                  alignment: _descriptor_4.alignment() }).encode() } },
                                                           { push: { storage: true,
                                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tmp_1),
                                                                                                                  alignment: _descriptor_1.alignment() }).encode() } },
                                                           { ins: { cached: false,
                                                                    n: 1 } },
                                                           { ins: { cached: true,
                                                                    n: 1 } }]);
                      }
                      const tmp_2 = 0n;
                      __compactRuntime.queryLedgerState(context,
                                                        partialProofData,
                                                        [
                                                         { idx: { cached: false,
                                                                  pushPath: true,
                                                                  path: [
                                                                         { tag: 'value',
                                                                           value: { value: _descriptor_4.toValue(3n),
                                                                                    alignment: _descriptor_4.alignment() } }] } },
                                                         { push: { storage: false,
                                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(slot_0),
                                                                                                                alignment: _descriptor_4.alignment() }).encode() } },
                                                         { push: { storage: true,
                                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(tmp_2),
                                                                                                                alignment: _descriptor_5.alignment() }).encode() } },
                                                         { ins: { cached: false,
                                                                  n: 1 } },
                                                         { ins: { cached: true,
                                                                  n: 1 } }]);
                      const tmp_3 = this._passbookCommitment_0(zero_0,
                                                               gs_0,
                                                               slot_0,
                                                               0n);
                      __compactRuntime.queryLedgerState(context,
                                                        partialProofData,
                                                        [
                                                         { idx: { cached: false,
                                                                  pushPath: true,
                                                                  path: [
                                                                         { tag: 'value',
                                                                           value: { value: _descriptor_4.toValue(2n),
                                                                                    alignment: _descriptor_4.alignment() } }] } },
                                                         { push: { storage: false,
                                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(slot_0),
                                                                                                                alignment: _descriptor_4.alignment() }).encode() } },
                                                         { push: { storage: true,
                                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(tmp_3),
                                                                                                                alignment: _descriptor_6.alignment() }).encode() } },
                                                         { ins: { cached: false,
                                                                  n: 1 } },
                                                         { ins: { cached: true,
                                                                  n: 1 } }]);
                      return t_0;
                    }),
                   [],
                   [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n]);
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _blockTimeLt_0(context, partialProofData, time_0) {
    return _descriptor_12.fromValue(__compactRuntime.queryLedgerState(context,
                                                                      partialProofData,
                                                                      [
                                                                       { dup: { n: 2 } },
                                                                       { idx: { cached: true,
                                                                                pushPath: false,
                                                                                path: [
                                                                                       { tag: 'value',
                                                                                         value: { value: _descriptor_4.toValue(2n),
                                                                                                  alignment: _descriptor_4.alignment() } }] } },
                                                                       { push: { storage: false,
                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(time_0),
                                                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                                                       'lt',
                                                                       { popeq: { cached: true,
                                                                                  result: undefined } }]).value);
  }
  _blockTimeGte_0(context, partialProofData, time_0) {
    return !this._blockTimeLt_0(context, partialProofData, time_0);
  }
  _transientHash_0(value_0) {
    const result_0 = __compactRuntime.transientHash(_descriptor_13, value_0);
    return result_0;
  }
  _transientCommit_0(value_0, rand_0) {
    const result_0 = __compactRuntime.transientCommit(_descriptor_10,
                                                      value_0,
                                                      rand_0);
    return result_0;
  }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_11, value_0);
    return result_0;
  }
  _degradeToTransient_0(x_0) {
    const result_0 = __compactRuntime.degradeToTransient(x_0);
    return result_0;
  }
  _localSecret_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.localSecret(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('localSecret',
                                 'return value',
                                 'undying.compact line 62 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _groupSecret_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.groupSecret(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('groupSecret',
                                 'return value',
                                 'undying.compact line 64 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _passbookOf_0(context, partialProofData, slot_0) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.passbookOf(witnessContext_0,
                                                                     slot_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'object' && typeof(result_0.shares) === 'bigint' && result_0.shares >= 0n && result_0.shares <= 4294967295n && typeof(result_0.socialFund) === 'bigint' && result_0.socialFund >= 0n && result_0.socialFund <= 4294967295n && typeof(result_0.loanOutstanding) === 'bigint' && result_0.loanOutstanding >= 0n && result_0.loanOutstanding <= 4294967295n)) {
      __compactRuntime.typeError('passbookOf',
                                 'return value',
                                 'undying.compact line 66 char 1',
                                 'struct Passbook<shares: Uint<0..4294967296>, socialFund: Uint<0..4294967296>, loanOutstanding: Uint<0..4294967296>>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_10.toValue(result_0),
      alignment: _descriptor_10.alignment()
    });
    return result_0;
  }
  _roleKey_0(domain_0, sk_0) {
    return this._persistentHash_0([domain_0, sk_0]);
  }
  _passbookSalt_0(gs_0, slot_0, version_0) {
    return this._transientHash_0([this._degradeToTransient_0(gs_0),
                                  slot_0,
                                  version_0]);
  }
  _passbookCommitment_0(pb_0, gs_0, slot_0, version_0) {
    return this._transientCommit_0(pb_0,
                                   this._passbookSalt_0(gs_0, slot_0, version_0));
  }
  _attestationId_0(nonce_0) {
    return this._persistentHash_0([new Uint8Array([117, 110, 100, 121, 105, 110, 103, 58, 97, 116, 116, 101, 115, 116, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   nonce_0]);
  }
  _requireSecretary_0(context, partialProofData) {
    __compactRuntime.assert(this._equal_0(_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_4.toValue(4n),
                                                                                                                                alignment: _descriptor_4.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value),
                                          this._roleKey_0(new Uint8Array([117, 110, 100, 121, 105, 110, 103, 58, 115, 101, 99, 114, 101, 116, 97, 114, 121, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                                          this._localSecret_0(context,
                                                                              partialProofData))),
                            'Only the group secretary can do this');
    return [];
  }
  _requireMaintainer_0(context, partialProofData) {
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_4.toValue(10n),
                                                                                                                  alignment: _descriptor_4.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value)
                            ===
                            0,
                            'Sunset has happened: admin-only paths are closed');
    __compactRuntime.assert(this._equal_1(_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_4.toValue(5n),
                                                                                                                                alignment: _descriptor_4.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value),
                                          this._roleKey_0(new Uint8Array([117, 110, 100, 121, 105, 110, 103, 58, 109, 97, 105, 110, 116, 97, 105, 110, 101, 114, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                                          this._localSecret_0(context,
                                                                              partialProofData))),
                            'Only the maintainer can do this');
    return [];
  }
  _checkedGroupSecret_0(context, partialProofData) {
    const gs_0 = this._groupSecret_0(context, partialProofData);
    __compactRuntime.assert(this._equal_2(_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_4.toValue(6n),
                                                                                                                                alignment: _descriptor_4.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value),
                                          this._roleKey_0(new Uint8Array([117, 110, 100, 121, 105, 110, 103, 58, 103, 114, 111, 117, 112, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                                          gs_0)),
                            'Wrong group secret');
    return gs_0;
  }
  _openPassbook_0(context, partialProofData, gs_0, slot_0) {
    const pb_0 = this._passbookOf_0(context, partialProofData, slot_0);
    const ver_0 = _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                            partialProofData,
                                                                            [
                                                                             { dup: { n: 0 } },
                                                                             { idx: { cached: false,
                                                                                      pushPath: false,
                                                                                      path: [
                                                                                             { tag: 'value',
                                                                                               value: { value: _descriptor_4.toValue(3n),
                                                                                                        alignment: _descriptor_4.alignment() } }] } },
                                                                             { idx: { cached: false,
                                                                                      pushPath: false,
                                                                                      path: [
                                                                                             { tag: 'value',
                                                                                               value: { value: _descriptor_4.toValue(slot_0),
                                                                                                        alignment: _descriptor_4.alignment() } }] } },
                                                                             { popeq: { cached: false,
                                                                                        result: undefined } }]).value);
    __compactRuntime.assert(_descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_4.toValue(2n),
                                                                                                                  alignment: _descriptor_4.alignment() } }] } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_4.toValue(slot_0),
                                                                                                                  alignment: _descriptor_4.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value)
                            ===
                            this._passbookCommitment_0(pb_0, gs_0, slot_0, ver_0),
                            'Passbook does not match the ledger');
    return pb_0;
  }
  _recordMeeting_0(context, partialProofData, page_0, entries_0) {
    this._requireSecretary_0(context, partialProofData);
    const gs_0 = this._checkedGroupSecret_0(context, partialProofData);
    const p_0 = page_0;
    if (this._equal_3(p_0, 0n)) {
      const tmp_0 = 1n;
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { idx: { cached: false,
                                                  pushPath: true,
                                                  path: [
                                                         { tag: 'value',
                                                           value: { value: _descriptor_4.toValue(7n),
                                                                    alignment: _descriptor_4.alignment() } }] } },
                                         { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                                { value: _descriptor_3.toValue(tmp_0),
                                                                  alignment: _descriptor_3.alignment() }
                                                                  .value
                                                              )) } },
                                         { ins: { cached: true, n: 1 } }]);
    }
    this._folder_1(context,
                   partialProofData,
                   ((context, partialProofData, t_0, j_0) =>
                    {
                      const slot_0 = ((t1) => {
                                       if (t1 > 255n) {
                                         throw new __compactRuntime.CompactError('undying.compact line 168 char 18: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 255');
                                       }
                                       return t1;
                                     })(p_0 * 5n + j_0);
                      const old_0 = this._openPassbook_0(context,
                                                         partialProofData,
                                                         gs_0,
                                                         slot_0);
                      const e_0 = entries_0[j_0];
                      const owed_0 = old_0.loanOutstanding + e_0.loanIssued;
                      let t_1;
                      __compactRuntime.assert((t_1 = e_0.loanRepaid,
                                               t_1 <= owed_0),
                                              'Repayment is larger than the loan');
                      let t_2;
                      const next_0 = { shares:
                                         ((t1) => {
                                           if (t1 > 4294967295n) {
                                             throw new __compactRuntime.CompactError('undying.compact line 174 char 15: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                                           }
                                           return t1;
                                         })(old_0.shares + e_0.shares),
                                       socialFund:
                                         ((t1) => {
                                           if (t1 > 4294967295n) {
                                             throw new __compactRuntime.CompactError('undying.compact line 175 char 19: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                                           }
                                           return t1;
                                         })(old_0.socialFund + e_0.socialFund),
                                       loanOutstanding:
                                         ((t1) => {
                                           if (t1 > 4294967295n) {
                                             throw new __compactRuntime.CompactError('undying.compact line 176 char 24: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                                           }
                                           return t1;
                                         })((t_2 = e_0.loanRepaid,
                                             (__compactRuntime.assert(owed_0
                                                                      >=
                                                                      t_2,
                                                                      'result of subtraction would be negative'),
                                              owed_0 - t_2))) };
                      const ver_0 = ((t1) => {
                                      if (t1 > 4294967295n) {
                                        throw new __compactRuntime.CompactError('undying.compact line 178 char 17: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                                      }
                                      return t1;
                                    })(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                 partialProofData,
                                                                                                 [
                                                                                                  { dup: { n: 0 } },
                                                                                                  { idx: { cached: false,
                                                                                                           pushPath: false,
                                                                                                           path: [
                                                                                                                  { tag: 'value',
                                                                                                                    value: { value: _descriptor_4.toValue(3n),
                                                                                                                             alignment: _descriptor_4.alignment() } }] } },
                                                                                                  { idx: { cached: false,
                                                                                                           pushPath: false,
                                                                                                           path: [
                                                                                                                  { tag: 'value',
                                                                                                                    value: { value: _descriptor_4.toValue(slot_0),
                                                                                                                             alignment: _descriptor_4.alignment() } }] } },
                                                                                                  { popeq: { cached: false,
                                                                                                             result: undefined } }]).value)
                                       +
                                       1n);
                      __compactRuntime.queryLedgerState(context,
                                                        partialProofData,
                                                        [
                                                         { idx: { cached: false,
                                                                  pushPath: true,
                                                                  path: [
                                                                         { tag: 'value',
                                                                           value: { value: _descriptor_4.toValue(3n),
                                                                                    alignment: _descriptor_4.alignment() } }] } },
                                                         { push: { storage: false,
                                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(slot_0),
                                                                                                                alignment: _descriptor_4.alignment() }).encode() } },
                                                         { push: { storage: true,
                                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(ver_0),
                                                                                                                alignment: _descriptor_5.alignment() }).encode() } },
                                                         { ins: { cached: false,
                                                                  n: 1 } },
                                                         { ins: { cached: true,
                                                                  n: 1 } }]);
                      const tmp_1 = this._passbookCommitment_0(next_0,
                                                               gs_0,
                                                               slot_0,
                                                               ver_0);
                      __compactRuntime.queryLedgerState(context,
                                                        partialProofData,
                                                        [
                                                         { idx: { cached: false,
                                                                  pushPath: true,
                                                                  path: [
                                                                         { tag: 'value',
                                                                           value: { value: _descriptor_4.toValue(2n),
                                                                                    alignment: _descriptor_4.alignment() } }] } },
                                                         { push: { storage: false,
                                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(slot_0),
                                                                                                                alignment: _descriptor_4.alignment() }).encode() } },
                                                         { push: { storage: true,
                                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(tmp_1),
                                                                                                                alignment: _descriptor_6.alignment() }).encode() } },
                                                         { ins: { cached: false,
                                                                  n: 1 } },
                                                         { ins: { cached: true,
                                                                  n: 1 } }]);
                      return t_0;
                    }),
                   [],
                   [0n, 1n, 2n, 3n, 4n]);
    return [];
  }
  _attestSavings_0(context, partialProofData, slot_0, minShares_0, nonce_0) {
    const s_0 = slot_0;
    __compactRuntime.assert(this._equal_4(_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_4.toValue(1n),
                                                                                                                                alignment: _descriptor_4.alignment() } }] } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_4.toValue(s_0),
                                                                                                                                alignment: _descriptor_4.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value),
                                          this._roleKey_0(new Uint8Array([117, 110, 100, 121, 105, 110, 103, 58, 109, 101, 109, 98, 101, 114, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                                          this._localSecret_0(context,
                                                                              partialProofData))),
                            'You are not the member in this slot');
    const gs_0 = this._checkedGroupSecret_0(context, partialProofData);
    const pb_0 = this._openPassbook_0(context, partialProofData, gs_0, s_0);
    let t_0;
    __compactRuntime.assert((t_0 = pb_0.shares, t_0 >= minShares_0),
                            'Not enough shares');
    const tmp_0 = this._attestationId_0(nonce_0);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_4.toValue(13n),
                                                                  alignment: _descriptor_4.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tmp_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(minShares_0),
                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _addMember_0(context, partialProofData, memberKey_0) {
    this._requireSecretary_0(context, partialProofData);
    let t_0;
    __compactRuntime.assert((t_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                             partialProofData,
                                                                                             [
                                                                                              { dup: { n: 0 } },
                                                                                              { idx: { cached: false,
                                                                                                       pushPath: false,
                                                                                                       path: [
                                                                                                              { tag: 'value',
                                                                                                                value: { value: _descriptor_4.toValue(0n),
                                                                                                                         alignment: _descriptor_4.alignment() } }] } },
                                                                                              { popeq: { cached: false,
                                                                                                         result: undefined } }]).value),
                             t_0 < 10n),
                            'Group is full');
    const tmp_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                            partialProofData,
                                                                            [
                                                                             { dup: { n: 0 } },
                                                                             { idx: { cached: false,
                                                                                      pushPath: false,
                                                                                      path: [
                                                                                             { tag: 'value',
                                                                                               value: { value: _descriptor_4.toValue(0n),
                                                                                                        alignment: _descriptor_4.alignment() } }] } },
                                                                             { popeq: { cached: false,
                                                                                        result: undefined } }]).value);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_4.toValue(1n),
                                                                  alignment: _descriptor_4.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(tmp_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(memberKey_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_1 = ((t1) => {
                    if (t1 > 255n) {
                      throw new __compactRuntime.CompactError('undying.compact line 205 char 17: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 255');
                    }
                    return t1;
                  })(_descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                               partialProofData,
                                                                               [
                                                                                { dup: { n: 0 } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_4.toValue(0n),
                                                                                                           alignment: _descriptor_4.alignment() } }] } },
                                                                                { popeq: { cached: false,
                                                                                           result: undefined } }]).value)
                     +
                     1n);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(0n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(tmp_1),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _handoverSecretary_0(context, partialProofData, newSecretary_0) {
    this._requireSecretary_0(context, partialProofData);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(4n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(newSecretary_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _adminReplaceSecretary_0(context, partialProofData, newSecretary_0) {
    this._requireMaintainer_0(context, partialProofData);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(4n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(newSecretary_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _heartbeat_0(context, partialProofData, now_0) {
    this._requireMaintainer_0(context, partialProofData);
    const t_0 = now_0;
    __compactRuntime.assert(this._blockTimeGte_0(context, partialProofData, t_0),
                            'Heartbeat time is in the future');
    __compactRuntime.assert(t_0
                            >=
                            _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_4.toValue(8n),
                                                                                                                  alignment: _descriptor_4.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value),
                            'Heartbeat time went backwards');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(8n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(t_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _sunset_0(context, partialProofData) {
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_4.toValue(10n),
                                                                                                                  alignment: _descriptor_4.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value)
                            ===
                            0,
                            'Already sunset');
    __compactRuntime.assert(this._blockTimeGte_0(context,
                                                 partialProofData,
                                                 ((t1) => {
                                                   if (t1 > 18446744073709551615n) {
                                                     throw new __compactRuntime.CompactError('undying.compact line 238 char 23: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                                   }
                                                   return t1;
                                                 })(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                              partialProofData,
                                                                                                              [
                                                                                                               { dup: { n: 0 } },
                                                                                                               { idx: { cached: false,
                                                                                                                        pushPath: false,
                                                                                                                        path: [
                                                                                                                               { tag: 'value',
                                                                                                                                 value: { value: _descriptor_4.toValue(8n),
                                                                                                                                          alignment: _descriptor_4.alignment() } }] } },
                                                                                                               { popeq: { cached: false,
                                                                                                                          result: undefined } }]).value)
                                                    +
                                                    _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                              partialProofData,
                                                                                                              [
                                                                                                               { dup: { n: 0 } },
                                                                                                               { idx: { cached: false,
                                                                                                                        pushPath: false,
                                                                                                                        path: [
                                                                                                                               { tag: 'value',
                                                                                                                                 value: { value: _descriptor_4.toValue(9n),
                                                                                                                                          alignment: _descriptor_4.alignment() } }] } },
                                                                                                               { popeq: { cached: false,
                                                                                                                          result: undefined } }]).value))),
                            'The maintainer is still sending heartbeats');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(10n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(1),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_0 = new Uint8Array(32);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(5n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tmp_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _rotateFeeKey_0(context, partialProofData, newFeeKeyTag_0) {
    this._requireSecretary_0(context, partialProofData);
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_4.toValue(11n),
                                                                  alignment: _descriptor_4.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_3.toValue(tmp_0),
                                                                alignment: _descriptor_3.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(12n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(newFeeKeyTag_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _folder_0(context, partialProofData, f, x, a0) {
    for (let i = 0; i < 10; i++) { x = f(context, partialProofData, x, a0[i]); }
    return x;
  }
  _equal_0(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_1(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_2(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_3(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _folder_1(context, partialProofData, f, x, a0) {
    for (let i = 0; i < 5; i++) { x = f(context, partialProofData, x, a0[i]); }
    return x;
  }
  _equal_4(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()),
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    get memberCount() {
      return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_4.toValue(0n),
                                                                                                   alignment: _descriptor_4.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    memberKeys: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_12.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_4.toValue(1n),
                                                                                                      alignment: _descriptor_4.alignment() } }] } },
                                                                           'size',
                                                                           { push: { storage: false,
                                                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                                                                  alignment: _descriptor_2.alignment() }).encode() } },
                                                                           'eq',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(1n),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 255n)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'undying.compact line 45 char 1',
                                     'Uint<0..256>',
                                     key_0)
        }
        return _descriptor_12.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_4.toValue(1n),
                                                                                                      alignment: _descriptor_4.alignment() } }] } },
                                                                           { push: { storage: false,
                                                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(key_0),
                                                                                                                                  alignment: _descriptor_4.alignment() }).encode() } },
                                                                           'member',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 255n)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'undying.compact line 45 char 1',
                                     'Uint<0..256>',
                                     key_0)
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(1n),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(key_0),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_4.fromValue(key.value),      _descriptor_1.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    passbooks: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_12.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_4.toValue(2n),
                                                                                                      alignment: _descriptor_4.alignment() } }] } },
                                                                           'size',
                                                                           { push: { storage: false,
                                                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                                                                  alignment: _descriptor_2.alignment() }).encode() } },
                                                                           'eq',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(2n),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 255n)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'undying.compact line 46 char 1',
                                     'Uint<0..256>',
                                     key_0)
        }
        return _descriptor_12.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_4.toValue(2n),
                                                                                                      alignment: _descriptor_4.alignment() } }] } },
                                                                           { push: { storage: false,
                                                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(key_0),
                                                                                                                                  alignment: _descriptor_4.alignment() }).encode() } },
                                                                           'member',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 255n)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'undying.compact line 46 char 1',
                                     'Uint<0..256>',
                                     key_0)
        }
        return _descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(2n),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(key_0),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[2];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_4.fromValue(key.value),      _descriptor_6.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    passbookVersion: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_12.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_4.toValue(3n),
                                                                                                      alignment: _descriptor_4.alignment() } }] } },
                                                                           'size',
                                                                           { push: { storage: false,
                                                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                                                                  alignment: _descriptor_2.alignment() }).encode() } },
                                                                           'eq',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(3n),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 255n)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'undying.compact line 47 char 1',
                                     'Uint<0..256>',
                                     key_0)
        }
        return _descriptor_12.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_4.toValue(3n),
                                                                                                      alignment: _descriptor_4.alignment() } }] } },
                                                                           { push: { storage: false,
                                                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(key_0),
                                                                                                                                  alignment: _descriptor_4.alignment() }).encode() } },
                                                                           'member',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 255n)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'undying.compact line 47 char 1',
                                     'Uint<0..256>',
                                     key_0)
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(3n),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(key_0),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[3];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_4.fromValue(key.value),      _descriptor_5.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    get secretaryKey() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_4.toValue(4n),
                                                                                                   alignment: _descriptor_4.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get maintainerKey() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_4.toValue(5n),
                                                                                                   alignment: _descriptor_4.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get groupKeyTag() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_4.toValue(6n),
                                                                                                   alignment: _descriptor_4.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get meetings() {
      return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_4.toValue(7n),
                                                                                                   alignment: _descriptor_4.alignment() } }] } },
                                                                        { popeq: { cached: true,
                                                                                   result: undefined } }]).value);
    },
    get lastHeartbeat() {
      return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_4.toValue(8n),
                                                                                                   alignment: _descriptor_4.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get graceSeconds() {
      return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_4.toValue(9n),
                                                                                                   alignment: _descriptor_4.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get phase() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_4.toValue(10n),
                                                                                                   alignment: _descriptor_4.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get feeKeyEpoch() {
      return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_4.toValue(11n),
                                                                                                   alignment: _descriptor_4.alignment() } }] } },
                                                                        { popeq: { cached: true,
                                                                                   result: undefined } }]).value);
    },
    get feeKeyTag() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_4.toValue(12n),
                                                                                                   alignment: _descriptor_4.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    attestations: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_12.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_4.toValue(13n),
                                                                                                      alignment: _descriptor_4.alignment() } }] } },
                                                                           'size',
                                                                           { push: { storage: false,
                                                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                                                                  alignment: _descriptor_2.alignment() }).encode() } },
                                                                           'eq',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(13n),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'undying.compact line 57 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_12.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_4.toValue(13n),
                                                                                                      alignment: _descriptor_4.alignment() } }] } },
                                                                           { push: { storage: false,
                                                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(key_0),
                                                                                                                                  alignment: _descriptor_1.alignment() }).encode() } },
                                                                           'member',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'undying.compact line 57 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(13n),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_1.toValue(key_0),
                                                                                                     alignment: _descriptor_1.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[13];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_1.fromValue(key.value),      _descriptor_5.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    }
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  localSecret: (...args) => undefined,
  groupSecret: (...args) => undefined,
  passbookOf: (...args) => undefined
});
export const pureCircuits = {
  roleKey: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`roleKey: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const domain_0 = args_0[0];
    const sk_0 = args_0[1];
    if (!(domain_0.buffer instanceof ArrayBuffer && domain_0.BYTES_PER_ELEMENT === 1 && domain_0.length === 32)) {
      __compactRuntime.typeError('roleKey',
                                 'argument 1',
                                 'undying.compact line 76 char 1',
                                 'Bytes<32>',
                                 domain_0)
    }
    if (!(sk_0.buffer instanceof ArrayBuffer && sk_0.BYTES_PER_ELEMENT === 1 && sk_0.length === 32)) {
      __compactRuntime.typeError('roleKey',
                                 'argument 2',
                                 'undying.compact line 76 char 1',
                                 'Bytes<32>',
                                 sk_0)
    }
    return _dummyContract._roleKey_0(domain_0, sk_0);
  },
  passbookSalt: (...args_0) => {
    if (args_0.length !== 3) {
      throw new __compactRuntime.CompactError(`passbookSalt: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const gs_0 = args_0[0];
    const slot_0 = args_0[1];
    const version_0 = args_0[2];
    if (!(gs_0.buffer instanceof ArrayBuffer && gs_0.BYTES_PER_ELEMENT === 1 && gs_0.length === 32)) {
      __compactRuntime.typeError('passbookSalt',
                                 'argument 1',
                                 'undying.compact line 80 char 1',
                                 'Bytes<32>',
                                 gs_0)
    }
    if (!(typeof(slot_0) === 'bigint' && slot_0 >= 0n && slot_0 <= 255n)) {
      __compactRuntime.typeError('passbookSalt',
                                 'argument 2',
                                 'undying.compact line 80 char 1',
                                 'Uint<0..256>',
                                 slot_0)
    }
    if (!(typeof(version_0) === 'bigint' && version_0 >= 0n && version_0 <= 4294967295n)) {
      __compactRuntime.typeError('passbookSalt',
                                 'argument 3',
                                 'undying.compact line 80 char 1',
                                 'Uint<0..4294967296>',
                                 version_0)
    }
    return _dummyContract._passbookSalt_0(gs_0, slot_0, version_0);
  },
  passbookCommitment: (...args_0) => {
    if (args_0.length !== 4) {
      throw new __compactRuntime.CompactError(`passbookCommitment: expected 4 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const pb_0 = args_0[0];
    const gs_0 = args_0[1];
    const slot_0 = args_0[2];
    const version_0 = args_0[3];
    if (!(typeof(pb_0) === 'object' && typeof(pb_0.shares) === 'bigint' && pb_0.shares >= 0n && pb_0.shares <= 4294967295n && typeof(pb_0.socialFund) === 'bigint' && pb_0.socialFund >= 0n && pb_0.socialFund <= 4294967295n && typeof(pb_0.loanOutstanding) === 'bigint' && pb_0.loanOutstanding >= 0n && pb_0.loanOutstanding <= 4294967295n)) {
      __compactRuntime.typeError('passbookCommitment',
                                 'argument 1',
                                 'undying.compact line 84 char 1',
                                 'struct Passbook<shares: Uint<0..4294967296>, socialFund: Uint<0..4294967296>, loanOutstanding: Uint<0..4294967296>>',
                                 pb_0)
    }
    if (!(gs_0.buffer instanceof ArrayBuffer && gs_0.BYTES_PER_ELEMENT === 1 && gs_0.length === 32)) {
      __compactRuntime.typeError('passbookCommitment',
                                 'argument 2',
                                 'undying.compact line 84 char 1',
                                 'Bytes<32>',
                                 gs_0)
    }
    if (!(typeof(slot_0) === 'bigint' && slot_0 >= 0n && slot_0 <= 255n)) {
      __compactRuntime.typeError('passbookCommitment',
                                 'argument 3',
                                 'undying.compact line 84 char 1',
                                 'Uint<0..256>',
                                 slot_0)
    }
    if (!(typeof(version_0) === 'bigint' && version_0 >= 0n && version_0 <= 4294967295n)) {
      __compactRuntime.typeError('passbookCommitment',
                                 'argument 4',
                                 'undying.compact line 84 char 1',
                                 'Uint<0..4294967296>',
                                 version_0)
    }
    return _dummyContract._passbookCommitment_0(pb_0, gs_0, slot_0, version_0);
  },
  attestationId: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`attestationId: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const nonce_0 = args_0[0];
    if (!(nonce_0.buffer instanceof ArrayBuffer && nonce_0.BYTES_PER_ELEMENT === 1 && nonce_0.length === 32)) {
      __compactRuntime.typeError('attestationId',
                                 'argument 1',
                                 'undying.compact line 88 char 1',
                                 'Bytes<32>',
                                 nonce_0)
    }
    return _dummyContract._attestationId_0(nonce_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
//# sourceMappingURL=index.js.map
