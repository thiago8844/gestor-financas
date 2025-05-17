<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Transacao extends Model
{
    /** @use HasFactory<\Database\Factories\TransacaoFactory> */
    use HasFactory;

    protected $table = 'transacao';
    protected $guarded = ['id'];

    public function conta()
    {
        return $this->belongsTo(Conta::class);
    }
    public function categoria()
    {
        return $this->belongsTo(Categoria::class);
    }

    public function orcamento()
    {
        return $this->belongsTo(Orcamento::class);
    }

    public function getTipoAttribute($value)
    {
        return $value === 'entrada' ? 'Entrada' : 'Saída';
    }
    public function getPagaAttribute($value)
    {
        return $value ? 'Sim' : 'Não';
    }

    public function getDataBrAttribute($value)
    {
        return Carbon::parse($value)->format('d/m/Y');
    }

    public function getDataTimeBrAttribute($value)
    {
        return Carbon::parse($value)->format('d/m/Y H:i');
    }

    public function getDateTimeBrAttribute()
    {
        return \Carbon\Carbon::parse($this->data)->format('d/m/Y H:i');
    }

}
