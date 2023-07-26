import { isCardTypeFilter, isEveryFilter, type Filter } from './query';
import * as a from 'indefinite';

interface ChooseCardSuggestion {
  suggestion: string; // suggests a UI text
  depth: number;
}

interface TextOpts {
  multipleSelection: boolean;
}
export function suggestCardChooserTitle(
  filter: Filter,
  depth: number = 0, //lower the depth, higher the priority
  textOpts?: TextOpts
): ChooseCardSuggestion[] {
  let MAX_RECURSION_DEPTH = 2;
  if (filter === undefined || depth + 1 > MAX_RECURSION_DEPTH) {
    return [];
  }
  let suggestions: ChooseCardSuggestion[] = [];
  //--base case--
  if ('on' in filter && filter.on !== undefined) {
    let cardRefName = (filter.on as { module: string; name: string }).name;
    return [{ suggestion: titleText(cardRefName, 'card', textOpts), depth }];
  }
  if (isCardTypeFilter(filter)) {
    let cardRefName = (filter.type as { module: string; name: string }).name;
    if (cardRefName == 'Card') {
      suggestions.push({
        suggestion: titleText(cardRefName, 'instance', textOpts),
        depth,
      });
    } else {
      suggestions.push({
        suggestion: titleText(cardRefName, 'card', textOpts),
        depth,
      });
    }
  }
  //--inductive case--
  if (isEveryFilter(filter)) {
    let nestedSuggestions = filter.every.flatMap((f) =>
      suggestCardChooserTitle(f, depth + 1)
    );
    suggestions = [...suggestions, ...nestedSuggestions];
  }
  return suggestions;
}

type CardNoun = 'instance' | 'type' | 'card';

function titleText(
  cardRefName: string,
  cardNoun: CardNoun,
  textOpts?: TextOpts
) {
  let object = `${cardRefName} ${cardNoun}`;
  if (textOpts?.multipleSelection) {
    return `Choose one or more ${object}`;
  } else {
    return `Choose ${a(object)}`;
  }
}

export function getSuggestionWithLowestDepth(
  items: ChooseCardSuggestion[]
): string | undefined {
  items.sort((a, b) => a.depth - b.depth);
  return items[0]?.suggestion;
}
