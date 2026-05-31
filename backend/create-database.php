<?php
// Script para criar o banco de dados se não existir

$host = getenv('DB_HOST');
$port = getenv('DB_PORT');
$user = getenv('DB_USERNAME');
$password = getenv('DB_PASSWORD');
$database = getenv('DB_DATABASE');

echo "Conectando ao MySQL em $host:$port...\n";

try {
    // Conecta sem especificar banco para criar
    $pdo = new PDO(
        "mysql:host=$host;port=$port",
        $user,
        $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    
    echo "Conectado com sucesso!\n";
    
    // Cria o banco
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    
    echo "Banco de dados '$database' criado/verificado com sucesso!\n";
    
} catch (PDOException $e) {
    echo "Erro ao conectar ou criar banco: " . $e->getMessage() . "\n";
    exit(1);
}
?>

