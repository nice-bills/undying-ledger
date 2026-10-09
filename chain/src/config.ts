// Adapted from midnightntwrk/example-private-party (Apache-2.0); Preprod now uses Blockfrost (see below).
// This file is part of example-private-party.
// Copyright (C) Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export type NetworkConfig = {
  networkId: string;
  indexer: string;
  indexerWS: string;
  node: string;
  nodeWS: string;
  proofServer: string;
  // Human-facing faucet page for topping up test wallets. Not a programmatic
  // drip endpoint — the tests assume seeds in .env.<network> are pre-funded.
  faucet: string;
};

export const LOCAL_CONFIG: NetworkConfig = {
  networkId: 'undeployed',
  indexer: 'http://localhost:8088/api/v4/graphql',
  indexerWS: 'ws://localhost:8088/api/v4/graphql/ws',
  node: 'http://localhost:9944',
  nodeWS: 'ws://localhost:9944',
  proofServer: 'http://localhost:6300',
  faucet: '',
};

export const PREVIEW_CONFIG: NetworkConfig = {
  networkId: 'preview',
  indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preview.midnight.network',
  nodeWS: 'wss://rpc.preview.midnight.network',
  proofServer: process.env['MIDNIGHT_PROOF_SERVER'] ?? 'http://127.0.0.1:6300',
  faucet: 'https://midnight-tmnight-preview.nethermind.dev/',
};

// Preprod moved to Blockfrost on 9 October 2026: Midnight shut down indexer.preprod.midnight.network
// and rpc.preprod.midnight.network from 22:00 UTC that day, and every Blockfrost request needs a
// Midnight Preprod project token (starts with "nightpreprod"). Built when used, not at import, so a
// missing token fails with a clear message. Source:
// https://docs.midnight.network/guides/networks-and-environments (checked 2026-10-09).
// (Changed from the example-private-party original, which still used the retired endpoints.)
function withBlockfrostKey(url: string, projectId: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}project_id=${encodeURIComponent(projectId)}`;
}

export function preprodConfig(): NetworkConfig {
  const projectId = process.env['BLOCKFROST_PROJECT_ID']?.trim();
  if (!projectId) {
    throw new Error('BLOCKFROST_PROJECT_ID is not set. Create a "Midnight Preprod" project at blockfrost.io and export its project ID.');
  }
  return {
    networkId: 'preprod',
    indexer: withBlockfrostKey('https://midnight-preprod.blockfrost.io/api/v0', projectId),
    indexerWS: withBlockfrostKey('wss://midnight-preprod.blockfrost.io/api/v0/ws', projectId),
    node: withBlockfrostKey('https://rpc.midnight-preprod.blockfrost.io', projectId),
    nodeWS: withBlockfrostKey('wss://rpc.midnight-preprod.blockfrost.io', projectId),
    proofServer: process.env['MIDNIGHT_PROOF_SERVER'] ?? 'http://127.0.0.1:6300',
    faucet: 'https://midnight-tmnight-preprod.nethermind.dev/',
  };
}

/** Strip the Blockfrost token from a URL or message before logging it. */
export const redactToken = (s: string): string => s.replace(/project_id=[^&\s"']+/g, 'project_id=***');

export function getConfig(): NetworkConfig {
  const network = process.env['MIDNIGHT_NETWORK'] ?? 'local';
  switch (network) {
    case 'local':
      return LOCAL_CONFIG;
    case 'preview':
      return PREVIEW_CONFIG;
    case 'preprod':
      return preprodConfig();
    default:
      throw new Error(
        `Unknown network: ${network}. Supported: 'local', 'preview', 'preprod'.`,
      );
  }
}
