# P80 読み取り専用の評価レシート連携

MarketはNaFTの研究数量を在庫に登録しない。既存の合成注文板に、手動で宣言したシリアルと評価履歴を結び付ける。JSON応答とHTMLのどちらにも参考評価額と模擬注文の金額を表示する。

| ファイル | 内容 |
|---|---|
| examples/p80-scenario.json | 独立した合成レジストリと売買注文・retirement要求 |
| examples/p80-bindings.json | シリアル、資産ID、シナリオID、初版の証拠、信頼する最新評価SHA-256 |
| examples/p80-history.json | 資産別のNaFT正準レシート履歴。単一レシート、単一資産の配列もCLIで受付 |
| examples/p80-suspension.json | 同一証拠が失効したNaFTの後続レシート |
| schemas/valuation-quote-v1.json | 両側で同一のJSON Schema 2020-12。実行コードは各リポジトリ内で完結 |

1. NaFTの隣接checkoutで `node scripts/valuation.mjs demo 2026-11-21T00:00:00.000Z > /tmp/naft-valuation.json` を実行する。
2. Marketで下記を実行する。Web画面用には末尾に `--html` を付けてファイルへ保存する。
3. 有効期限以降は売り・買いともに停止し、retirementはBLOCKED_NO_MATCHとなる。時刻引数なしでは現在時刻を使う。

```sh
node scripts/valuation-book.mjs examples/p80-scenario.json examples/p80-bindings.json /tmp/naft-valuation.json 2026-11-21T00:00:00.000Z
```

下記は同梱の失効fixtureを採用する履歴更新の再現手順。本番の真正性・失効通知を示すものではない。

```sh
node --input-type=module <<'JS'
import fs from 'node:fs';
const read = name => JSON.parse(fs.readFileSync('examples/p80-'+name+'.json'));
const h = read('history'), next = read('suspension'), b = read('bindings');
h[0].push(next);
b[0].current_receipt_sha256 = next.receipt_sha256;
fs.writeFileSync('/tmp/p80-updated-history.json',JSON.stringify(h));
fs.writeFileSync('/tmp/p80-updated-bindings.json',JSON.stringify(b));
JS
node scripts/valuation-book.mjs examples/p80-scenario.json /tmp/p80-updated-bindings.json /tmp/p80-updated-history.json 2026-11-21T00:01:00.000Z
```

## 既知の境界

SHA-256は整合性検査に用いる。本運用の発行者署名・外部失効通知はない。利用側は最新headをレシートと別の信頼経路で取得する。攻撃者が履歴とpinを両方置換できる環境では出所を保証できない。注文板は決定論的な一回のシナリオ再生であり、複数プロセスをまたぐ在庫台帳ではない。リプレイに実際の移転効果はない。Marketの31テストには、既存21ケースとP80の10ケースが含まれる。

実ステーブルコイン・実クレジット・実注文や資金を取り扱う機能は提供しない。将来の発行・預託・仲介を検討する際は、利用者と提供者の役割、法的レビュー、必要な登録・許認可と本人確認を別フェーズで扱う。[金融庁の制度案内](https://www.fsa.go.jp/policy/virtual_currency02/)
