const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function table(headings,rows) {
  const cells = (values,tag) => values.map(v=>'<'+tag+'>'+escape(v)+'</'+tag+'>').join('');
  return '<table><thead><tr>'+cells(headings,'th')+'</tr></thead><tbody>'+
    rows.map(row=>'<tr>'+cells(row,'td')+'</tr>').join('')+'</tbody></table>';
}
export function valuationReport(book) {
  const result = book.simulated_market;
  const listings = book.listings.map(({serial,state,quote:q})=>[serial,state,
    q?.reference_value_jpy ?? '—',q?.reference_value_usd ?? '—',q ? q.gross_amount+' '+q.asset_symbol : '—']);
  const orders = book.orders.map(o=>[o.id,o.side,o.serial,o.limit_price_jpy,
    result.blocked_orders.find(b=>b.order_id===o.id)?.reason ??
    (result.matches.some(m=>[m.buy_order_id,m.sell_order_id].includes(o.id)) ? 'MATCHED' : 'UNMATCHED')]);
  const matches = result.matches.map(m=>{
    const v=m.valuation_settlement;
    return [m.serial,v.execution_jpy,v.execution_usd,v.asset_symbol,v.gross_amount,v.estimated_fee,v.net_amount,v.status];
  });
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>模擬注文板 | NFTM</title><style>body{font:16px/1.65 system-ui,sans-serif;color:#18342a;background:#f4f7f4;margin:24px auto;max-width:1120px;padding:16px}section{background:white;padding:18px;margin:16px 0;border:1px solid #cbd8ce;border-radius:10px;overflow:auto}table{border-collapse:collapse}th,td{text-align:left;padding:8px;border-bottom:1px solid #cbd8ce}h2{font-size:20px}code{overflow-wrap:anywhere}</style>
<h1>模擬注文板</h1><p>SIMULATION_ONLY · ${escape(book.as_of)} · すべての金額と単位数は仮定に基づく参考値です。</p>
<section><h2>研究用評価と掲載状態</h2>${table(['合成シリアル','状態','参考評価額 JPY','参考評価額 USD','参考単位'],listings)}</section>
<section><h2>模擬注文</h2>${table(['注文','売買','合成シリアル','指値 JPY','結果'],orders)}</section>
<section><h2>模擬約定・決済</h2>${table(['合成シリアル','約定 JPY','約定 USD','単位','総額','想定手数料','差引','結果'],matches)}
<p>実資金移動 0 件 · MRVから発行したクレジット 0 件</p></section>
<section><h2>監査レシート</h2><code>${escape(result.receipt_sha256)}</code></section></html>`;
}
