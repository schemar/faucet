import BN from 'bn.js';
import config from 'config';
import { Contract } from 'web3-eth-contract';

import ABI from '../ABI';
import Account from '../Account';
import Faucet from './Faucet';
import Logger from '../Logger';

/**
 * An EIP20 faucet sends value in the form of EIP20 tokens by sending a transfer transaction to the
 * EIP20 token.
 */
export default class EIP20Faucet implements Faucet {
  /** The amount to transfer with every fill request. */
  readonly amount: string;
  /** The EIP20 token contract that where the transfer for funding is executed. */
  private eip20Contract: Contract;

  /**
   * @param account The faucet will use this account to fill other accounts.
   * @param chain The identifier of the chain that this faucet uses.
   */
  constructor(readonly account: Account, readonly chain: string) {
    const addressConfigAccessor = `Chains.${chain}.Funds.Address`;
    if (!config.has(addressConfigAccessor)) {
      throw new Error(`Missing config key ${addressConfigAccessor}!`);
    }

    const eip20Address = config.get(addressConfigAccessor);
    this.eip20Contract = new this.account.web3.eth.Contract(
      ABI.EIP20Token,
      eip20Address,
    );

    const amountConfigAccessor = `Chains.${chain}.Funds.Amount`;
    if (!config.has(amountConfigAccessor)) {
      throw new Error(`Missing config key ${amountConfigAccessor}!`);
    }

    this.amount = config.get(amountConfigAccessor);
  }

  /**
   * Sends value to the given address.
   * @param address The beneficiary.
   * @returns The transaction hash wrapped in a promise.
   */
  public fill(address: string): Promise<string> {
    Logger.info('sending EIP20 tokens', { chain: this.chain, amount: this.amount, toWhom: address });

    const transferTx: any = this.eip20Contract.methods.transfer(
      address,
      this.amount,
    );

    return this.sendTransactions(transferTx, address);
  }

  private async sendTransactions(transferTx: any, address: string): Promise<string> {
    await this.checkBalance();

    // Gas estimation also checks that a call passes, meaning the contract would not revert.
    // Otherwise the transaction hash would return a success case when actually the funding would
    // not pass and the transaction would revert.
    const gas = await transferTx.estimateGas({ from: this.account.address });
    const nonce = await this.account.getNonce();

    // Wrapping the event emitter in a promise to resolve or reject immediately when the events are
    // emitted and not wait for the transfer PromiEvent to resolve, which would only resolve after
    // the transaction had been mined.
    return new Promise((resolve, reject) => {
      transferTx
        .send({ from: this.account.address, gas, nonce })
        .on('transactionHash',
          (txHash) => {
            Logger.info(
              'sent EIP20 tokens',
              { chain: this.chain, amount: this.amount, toWhom: address, txHash },
            );

            return resolve(txHash);
          },
        ).on('error',
          reject,
        );
    })
  }

  /**
   * @throws Error if the balance is not sufficient to fund.
   */
  private async checkBalance(): Promise<void> {
    const balanceOfTx: any = this.eip20Contract.methods.balanceOf(this.account.address);

    // Some type-juggling is required here as Web3 returns neither a fully compatible BN nor a
    // fully compatible BigNumber. Thus, converting everything to BN and making the comparison.
    let balanceBn = await balanceOfTx.call({ from: this.account.address });
    balanceBn = new BN(balanceBn.toString(10));
    const amountBn = new BN(this.amount);

    if (balanceBn.lt(amountBn)) {
      throw new Error('not enough balance to fund');
    }
  }
}
