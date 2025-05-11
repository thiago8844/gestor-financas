<?php

 //Vai retornar o valor no formato padrão do sistema
if (!function_exists('formatCurrency')) {
    function formatCurrency(float $number): string
    {
        return number_format($number, 2, ',', '.');
    }
}