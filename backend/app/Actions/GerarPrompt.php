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
  public static function execute(User $user): array
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


    return [
      'periodo_meses' => $meses_periodo,

      'patrimonio_liquido' => round($patrimonioLiquido, 2),

      'renda' => [
        'media_mensal' => round($rendaMedia ?? 0, 2),
        'desvio_padrao' => round($desvioPadraoReceita ?? 0, 2),
        'desvio_padrao_percentual' => round($desvioPadraoProporcaoReceita ?? 0, 2),
      ],

      'despesas' => [
        'media_mensal' => round($despesaMedia ?? 0, 2),
        'desvio_padrao' => round($desvioPadraoDespesa ?? 0, 2),
        'desvio_padrao_percentual' => round($desvioPadraoProporcaoDespesa ?? 0, 2),
      ],

      'saldo' => [
        'medio_mensal' => round($saldoMedioMensal ?? 0, 2),
        'tendencia_percentual' => round($tendenciaSaldo ?? 0, 2),
      ],

      'regras_interpretacao' => [
        'desvio_padrao' => 'Mede estabilidade. Quanto menor, mais previsível.',
        'tendencia_saldo' => 'Indica crescimento ou perda patrimonial.',
        'orientacao' => 'Use esses números como o retrato financeiro atual do usuário.',
      ],
    ];
  }
}
