<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Conta extends Model
{
    /** @use HasFactory<\Database\Factories\ContaFactory> */
    use HasFactory;

    protected $table = 'accounts';
    protected $guarded = ['id'];

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

}
