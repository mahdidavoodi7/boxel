import {
  contains,
  field,
  Component,
  Card,
  linksTo,
} from 'https://cardstack.com/base/card-api';
import BooleanCard from 'https://cardstack.com/base/boolean';
import StringCard from 'https://cardstack.com/base/string';
import { CardContainer, FieldContainer } from '@cardstack/boxel-ui';
import IntegerCard from 'https://cardstack.com/base/integer';
import { Chain } from './chain';

export class Transaction extends Card {
  static displayName = 'Transaction';
  @field transactionHash = contains(StringCard);
  @field status = contains(BooleanCard);
  @field blockHash = contains(StringCard);
  @field blockNumber = contains(IntegerCard);
  @field from = contains(StringCard);
  @field to = contains(StringCard);
  @field memo = contains(StringCard);
  @field chain = linksTo(() => Chain);
  @field gasUsed = contains(IntegerCard);
  @field effectiveGasPrice = contains(IntegerCard);
  @field blockExplorerLink = contains(StringCard, {
    computeVia: function (this: Transaction) {
      return `${this.chain.blockExplorer}/tx/${this.transactionHash}`;
    },
  });
  @field title = contains(StringCard, {
    computeVia: function (this: Transaction) {
      return `Txn ${this.transactionHash}`;
    },
  });

  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <CardContainer class='demo-card' @displayBoundaries={{true}}>
        <FieldContainer @label='Title'><@fields.title /></FieldContainer>
        <FieldContainer @label='From'><@fields.from /></FieldContainer>
        <FieldContainer @label='To'><@fields.to /></FieldContainer>
        <FieldContainer @label='BlockNumber'><@fields.blockNumber
          /></FieldContainer>
        <FieldContainer @label='BlockExplorer'>
          <a href={{@model.blockExplorerLink}}>{{@model.blockExplorerLink}}</a>
        </FieldContainer>
        <FieldContainer @label='Status'><@fields.status /></FieldContainer>
        <FieldContainer @label='Memo'><@fields.memo /></FieldContainer>
      </CardContainer>
    </template>
  };

  static isolated = class Isolated extends Component<typeof Transaction> {
    <template>
      <CardContainer class='demo-card' @displayBoundaries={{true}}>
        <FieldContainer @label='Title'><@fields.title /></FieldContainer>
        <FieldContainer @label='Status'><@fields.status /></FieldContainer>
        <FieldContainer @label='Chain'><@fields.chain /></FieldContainer>
        <FieldContainer @label='BlockHash'><@fields.blockHash
          /></FieldContainer>
        <FieldContainer @label='BlockNumber'><@fields.blockNumber
          /></FieldContainer>
        <FieldContainer @label='From'><@fields.from /></FieldContainer>
        <FieldContainer @label='To'><@fields.to /></FieldContainer>
        <FieldContainer @label='GasUsed'><@fields.gasUsed /></FieldContainer>
        <FieldContainer @label='EffectiveGasPrice'><@fields.effectiveGasPrice
          /></FieldContainer>
        <FieldContainer @label='BlockExplorer'>
          <a href={{@model.blockExplorerLink}}>{{@model.blockExplorerLink}}</a>
        </FieldContainer>

        <FieldContainer @label='Memo'><@fields.memo /></FieldContainer>
      </CardContainer>
    </template>
  };
}