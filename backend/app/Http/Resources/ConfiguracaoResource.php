<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ConfiguracaoUsuario */
class ConfiguracaoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'notify_upcoming_days' => $this->notify_upcoming_days,
            'auto_pay_invoices' => $this->auto_pay_invoices,
            'notify_overdue_days' => $this->notify_overdue_days,
        ];
    }
}
