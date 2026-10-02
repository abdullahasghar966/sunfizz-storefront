/**
 * Drop-in replacement for Hydrogen's <Money> that pins the number of decimals
 * (none for whole amounts, two otherwise) instead of relying on each runtime's
 * built-in currency data. That data differs between ICU versions (PKR gets two
 * decimals in the dev server's workerd but none in current browsers), so the
 * server and browser printed different strings and React threw away the
 * server-rendered HTML on every page that showed a price.
 */
type MoneyData = {amount?: string | null; currencyCode?: string | null};

export function Money({data}: {data?: MoneyData | null}) {
  if (!data?.amount || !data.currencyCode) return null;

  const amount = Number(data.amount);
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;

  return (
    <div>
      {new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: data.currencyCode,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(amount)}
    </div>
  );
}
