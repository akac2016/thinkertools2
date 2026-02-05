<?php  
session_start();
$entryTime = date('Y-m-d H:i:s');
require "qxdb.php";
/* insert discuss entry */
$stmt = $mysqli->prepare("INSERT INTO session_discuss (sessionID, userID, entry, entryTime) VALUES (?,?,?,?)");
$stmt->bind_param("iiss", $_SESSION['sessionID'], $_SESSION['userID'], $_GET['discussEntry'], $entryTime);
$stmt->execute();
$stmt->close();
?>