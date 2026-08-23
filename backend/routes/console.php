<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// TODO: em produção (Railway), garantir que algo dispare isso todo dia (revisão separada).
Schedule::command('recorrencias:gerar')->dailyAt('06:00');
