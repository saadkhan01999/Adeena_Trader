/**
 * One line of document Urdu, from the parts agreementUrdu.js produces:
 * translated text with the filled-in details (names, amounts, dates) kept
 * left-to-right inside it. Renders nothing when Urdu is off or when the
 * English has no translation.
 */

import { useUrduEnabled } from '../../context/settingsStore.js';
import { urduParts } from '../../i18n/agreementUrdu.js';
import { cn } from '../../utils/index.js';

export default function UrduLine({ english, parts, className, as: Tag = 'p' }) {
  const enabled = useUrduEnabled();
  if (!enabled) return null;

  const resolved = parts || urduParts(english);
  if (!resolved) return null;

  return (
    <Tag dir="rtl" lang="ur" className={cn('urdu', className)}>
      {resolved.map((part, index) =>
        typeof part === 'string' ? (
          <span key={index}>{part}</span>
        ) : (
          <bdi key={index} className="font-sans font-medium">{part.value}</bdi>
        )
      )}
    </Tag>
  );
}
