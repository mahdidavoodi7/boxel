import { contains, field, Card, Component } from 'https://cardstack.com/base/card-api';
import StringCard from 'https://cardstack.com/base/string';
import IntegerCard from 'https://cardstack.com/base/integer';
import BooleanCard from 'https://cardstack.com/base/boolean';

export class Pet extends Card {
  @field firstName = contains(StringCard);
  @field favoriteToy = contains(StringCard);
  @field favoriteTreat = contains(StringCard);
  @field cutenessRating = contains(IntegerCard);
  @field sleepsOnTheCouch = contains(BooleanCard);
  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <style>
        .pet {
          border: 1px solid gray;
          border-radius: 10px;
          background-color: #fdfcdc;
          padding: 1rem;
        }
      </style>
      <div class="pet"><@fields.firstName/></div>
    </template>
  }
}