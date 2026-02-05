<?php
//connect to accounts database
$mysqli = new mysqli("localhost:3306", "n797815_ttadmin", "mnA&Iwpi2021ttdb", "n797815_accounts"); 
if ($mysqli->connect_errno) {
printf("Connect failed: %s\n", $mysqli->connect_error);
exit();
}
?>