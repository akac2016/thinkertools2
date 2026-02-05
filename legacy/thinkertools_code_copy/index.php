<?php session_start();
header('Location: home.php');
	// db connect
	// require('accountsdb.php');
	// require('woidb.php');
	// require('qxdb.php');
?>
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools temp landing page</title>
		<link rel="stylesheet" href="main.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="mainhead.css" content="text/html; charset=utf-8"/>
	</head>
	<body>
		<div class="container" style="text-align: center;">
			<br /><br />
			Hello World!! <br /><br />
			Thinkertools will be back on line<br />
			May 2025 <br /><br />
		</div>
		<?php
			// test accountsdb connect
			require('accountsdb.php');
			$userID=5;
			$getUser = "SELECT username FROM ttuser WHERE userID=?";
        	$user = $mysqli->execute_query($getUser, [$userID])->fetch_assoc();
        	print '<div style="margin-left:48px; font-size:8px; font-family:sans-serif; color:#D3D3D3;">'; 
        	echo $user['username'];
        	print '</div>';
        	// test webofinquiry db connect
//        	require('woidb.php');
//			$template_id=13;
//			$getTemplate = "SELECT template_name FROM template WHERE template_id=?";
//        	$template = $mysqli->execute_query($getTemplate, [$template_id])->fetch_assoc();
//        	print '<div style="margin-left:48px; font-size:8px; font-family: sans-serif; color:#D3D3D3;">'; 
//        	echo $template['template_name'];
//        	print '</div>';
        	// test quipx db connect
//        	require('qxdb.php');
//			$sessionID=1;
//			$getSession = "SELECT subject FROM session WHERE sessionID=?";
//        	$session = $mysqli->execute_query($getSession, [$sessionID])->fetch_assoc();
//        	print '<div style="margin-left:48px; font-size:8px; font-family: sans-serif; color:#D3D3D3;">'; 
//        	echo $session['subject'];
//        	print '</div>';
		?>
	</body>
</html>