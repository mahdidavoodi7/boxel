import {
  contains,
  linksTo,
  field,
  Card,
} from 'https://cardstack.com/base/card-api';
import MetadataCard from 'https://cardstack.com/base/metadata';
import StringCard from 'https://cardstack.com/base/string';

export class Friend extends Card {
  @field firstName = contains(StringCard);
  @field friend = linksTo(() => Friend);
  @field _metadata = contains(MetadataCard, {
    computeVia: function (this: Friend) {
      let metadata = new MetadataCard();
      metadata.title = this.firstName;
      return metadata;
    },
  });
}
