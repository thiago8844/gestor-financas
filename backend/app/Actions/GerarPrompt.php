<?php

namespace App\Actions;

use App\Enums\TransactionType;
use App\Models\Conta;
use App\Models\User;
use App\Queries\DesvioPadraoQuery;
use App\Queries\SaldoMedioMensal;
use App\Queries\TendenciaSaldo;
use Illuminate\Support\Facades\DB;

class GerarPrompt
{
  public static function execute(User $user): string
  {
    //Saldo líquido médio mensal  Tendência de saldo

    $datas = DB::table('transactions')
      ->where('user_id', $user->id)
      ->selectRaw('MIN(date) as data_min, MAX(date) as data_max')
      ->first();

    if ($datas->data_min && $datas->data_max) {
      $meses = round((strtotime($datas->data_max) - strtotime($datas->data_min)) / (30.44 * 24 * 60 * 60), 1);
      $meses_periodo = min($meses, 12);
    } else {
      $meses_periodo = 0;
    }

    $contas = Conta::where('user_id', $user->id)->get();

    $patrimonioLiquido = $contas->sum(function ($conta) {
      return $conta->include_in_networth ? $conta->saldo : 0;
    });

    //TODO: JOGAR EM /QUERIES        
    $rendaMedia = DB::table('transactions')
      ->selectRaw("DATE_FORMAT(date, '%Y-%m') as mes, SUM(amount) as total_mes")
      ->where('user_id', $user->id)
      ->where('type', 'INCOME')
      ->where('date', '>=', DB::raw("DATE_SUB(NOW(), INTERVAL 12 MONTH)"))
      ->groupBy('mes')
      ->orderByDesc('mes')
      ->get()
      ->avg('total_mes');

    $despesaMedia = DB::table('transactions')
      ->selectRaw("DATE_FORMAT(date, '%Y-%m') as mes, SUM(amount) as total_mes")
      ->where('user_id', $user->id)
      ->where('type', 'EXPENSE')
      ->where('date', '>=', DB::raw("DATE_SUB(NOW(), INTERVAL 12 MONTH)"))
      ->groupBy('mes')
      ->orderByDesc('mes')
      ->get()
      ->avg('total_mes');

    $saldoMedioMensal = SaldoMedioMensal::calcular($user);
    $tendenciaSaldo = TendenciaSaldo::calcular($user);
    $desvioPadraoDespesa = DesvioPadraoQuery::calcular($user, TransactionType::EXPENSE);

    $desvioPadraoProporcaoDespesa = $despesaMedia != 0 ? ($desvioPadraoDespesa / $despesaMedia) * 100 : 0.0;

    $desvioPadraoReceita = DesvioPadraoQuery::calcular($user, TransactionType::INCOME);

    $desvioPadraoProporcaoReceita = $rendaMedia != 0 ? ($desvioPadraoReceita / $rendaMedia) * 100 : 0.0;


    return "
          Você é um consultor financeiro pessoal. Responda com base nas boas práticas de finanças pessoais (limite de aluguel, poupança ideal, risco e estabilidade de renda), sem inventar valores futuros.

          Dados do usuário:
          - Patrimônio líquido: R$ {$patrimonioLiquido}
          - Renda média (últimos {$meses_periodo} meses): R$ {$rendaMedia}
          - Despesa média: R$ {$despesaMedia}
          - Saldo líquido médio mensal: R$ {$saldoMedioMensal}
          - Tendência de saldo: {$tendenciaSaldo}%
          - Desvio padrão da renda: {$desvioPadraoReceita} ({$desvioPadraoProporcaoReceita}%)
          - Desvio padrão das despesas: {$desvioPadraoDespesa} ({$desvioPadraoProporcaoDespesa}%)

          Regra:
          - O desvio padrão mede estabilidade (quanto menor, mais previsível).
          - A tendência de saldo indica crescimento ou perda patrimonial.
          - Use esses números como o retrato atual da pessoa.

          Responda de forma objetiva, prática e contextualizada à pergunta do usuário.
    ";
  }
}
