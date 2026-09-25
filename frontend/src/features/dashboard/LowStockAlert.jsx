/**
 * The low-stock alert on the dashboard: shown only when something needs
 * reordering, naming the items, with one click through to Inventory filtered
 * to exactly those items.
 */

import { TriangleAlert, ArrowRight, PackageX } from 'lucide-react';
import { Urdu } from '../../components/common/Bilingual.jsx';
import { cn } from '../../utils/index.js';

export default function LowStockAlert({ items = [], lowCount = 0, outCount = 0, onOpen }) {
  const total = lowCount + outCount;
  if (total === 0) return null;

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-xl border-2 p-3.5 sm:p-4 soft-in',
        outCount > 0 ? 'border-danger-300 bg-danger-50' : 'border-warning-300 bg-warning-50'
      )}
      role="alert"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span
            className={cn(
              'flex items-center justify-center w-11 h-11 rounded-xl text-white flex-shrink-0 shadow-sm',
              outCount > 0 ? 'bg-danger-600' : 'bg-warning-500'
            )}
          >
            {outCount > 0 ? <PackageX size={22} /> : <TriangleAlert size={22} />}
          </span>

          <div className="min-w-0">
            <p className={cn('text-sm sm:text-base font-bold', outCount > 0 ? 'text-danger-800' : 'text-warning-900')}>
              Low stock alert
              <Urdu className="ml-2 text-sm font-normal">کم اسٹاک</Urdu>
            </p>
            <p className="text-xs sm:text-sm text-navy-700">
              {outCount > 0 && <strong>{outCount} out of stock</strong>}
              {outCount > 0 && lowCount > 0 && ' and '}
              {lowCount > 0 && <strong>{lowCount} running low</strong>}
              {' '}- reorder soon so a sale is never turned away.
            </p>

            {items.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {items.slice(0, 6).map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-warning-200 text-2xs font-medium text-navy-800"
                  >
                    {item.name}
                    <strong className={cn('tabular', item.stock === 0 ? 'text-danger-600' : 'text-warning-700')}>
                      {item.stock} left
                    </strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className={cn(
            'btn self-start sm:self-center flex-shrink-0 text-white shadow-xs',
            outCount > 0 ? 'bg-danger-600 hover:bg-danger-700' : 'bg-warning-600 hover:bg-warning-700'
          )}
        >
          Review stock <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}
