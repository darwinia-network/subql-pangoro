import { SubstrateEvent } from '@subql/types';
import { S2SEvent } from '../../types';

export class S2SEventHandler {
  private event: SubstrateEvent;

  constructor(event: SubstrateEvent) {
    this.event = event;
  }

  get method() {
    return this.event.event.method;
  }

  get data() {
    return this.event.event.data.toString();
  }

  get id() {
    const [laneId, nonce] = JSON.parse(this.data);

    return `${laneId}0x${nonce}`;
  }

  // hash requestTxHash/responseTxHash
  get extrinsicHash() {
    const i = this.event?.extrinsic?.extrinsic?.hash?.toString();

    return i === 'null' ? undefined : i;
  }

  // startTimestamp/endTimestamp
  get timestamp() {
    return this.event.block.timestamp;
  }

  public async save() {
    // data structure: https://github.com/darwinia-network/darwinia-common/blob/master/frame/wormhole/backing/s2s/src/lib.rs

    if (this.method === 'TokenLocked') {
      // [lane_id, message_nonce, token address, sender, recipient, amount]
      const [laneId, nonce, token, sender, recipient, value] = JSON.parse(this.data) as [
        string,
        bigint,
        string | Record<string, any>,
        string,
        string,
        number
      ];
      const event = new S2SEvent(this.id);

      event.laneId = laneId;
      event.nonce = nonce;
      event.requestTxHash = this.extrinsicHash;
      event.startTimestamp = this.timestamp;
      event.sender = sender;
      event.recipient = recipient;
      event.token = typeof token === 'string' ? token : token.native.address;
      event.amount = value.toString();
      event.result = 0;
      event.endTimestamp = null;
      event.responseTxHash = null;

      await event.save();
    }

    if (this.method === 'TokenLockedConfirmed') {
      // [lane_id, message_nonce, user, amount, result]
      const [laneId, nonce, _1, _2, confirmResult] = JSON.parse(this.data) as [
        string,
        bigint,
        string | Record<string, any>,
        string,
        boolean
      ];

      const event = await S2SEvent.get(this.id);

      if (event) {
        event.responseTxHash = this.extrinsicHash;
        event.endTimestamp = this.timestamp;
        event.result = confirmResult ? 1 : 2;

        await event.save();
      }
    }

    if (this.method === 'TokenUnlocked') {
      // [lane_id, message_nonce, token_address, recipient, amount]
      const [laneId, nonce, token, recipient, amount] = JSON.parse(this.data) as [
        string,
        bigint,
        string | Record<string, any>,
        string,
        string,
        number
      ];

      const event = await S2SEvent.get(this.id);

      if (event) {
        event.laneId = laneId;
        event.nonce = nonce;
        event.recipient = recipient;
        event.requestTxHash = this.extrinsicHash;
        event.responseTxHash = this.extrinsicHash;
        event.amount = amount;
        event.token = typeof token === 'string' ? token : token.native.address;
        event.startTimestamp = this.timestamp;
        event.endTimestamp = this.timestamp;
        event.result = 1;
      }
    }
  }
}
