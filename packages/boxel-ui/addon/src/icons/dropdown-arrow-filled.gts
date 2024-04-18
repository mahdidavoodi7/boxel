// This file is auto-generated by 'pnpm rebuild:icons'
import type { TemplateOnlyComponent } from '@ember/component/template-only';

import type { Signature } from './types.ts';

const IconComponent: TemplateOnlyComponent<Signature> = <template>
  <svg
    xmlns='http://www.w3.org/2000/svg'
    fill='var(--icon-color, #000)'
    viewBox='0 0 12.57 8'
    ...attributes
  ><path
      d='M7.259 7.5a1.2 1.2 0 0 1-1.947 0L.268 1.213C-.268.546.024 0 .916 0h10.739c.892 0 1.184.546.648 1.213z'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'DropdownArrowFilled';
export default IconComponent;
