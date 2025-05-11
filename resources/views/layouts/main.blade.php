<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Gestor Finanças</title>

    @vite(['resources/css/app.css', 'resources/scss/app.scss'])
    @vite('resources/css/app.css')
    @stack('styles')
  </head>
  <body>

    <x-navbar/>
    
    @yield('content')


    @vite('resources/js/app.js')

    @stack('scripts')
  </body>
</html>