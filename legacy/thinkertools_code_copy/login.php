<?php session_start();
	// user account db
	require('accountsdb.php');
	// login check
	$logincheck = 1;
	if ($_GET['action'] == 'check') {
		$getUserID = "SELECT userID, active, teacher FROM ttuser WHERE username=? AND password=?";
        $userID = $mysqli->execute_query($getUserID, [$_POST['username'], $_POST['password']])->fetch_assoc();        
        if ($userID['userID'] > 0 && $userID['active'] == 1) {
        	$_SESSION['userID'] = $userID['userID'];
        	$getfirstname = "SELECT firstname FROM ttuser WHERE userID=?";
        	$firstname = $mysqli->execute_query($getfirstname, [$userID['userID']])->fetch_assoc();
        	$_SESSION['firstname'] = $firstname['firstname'];
        	echo "<script>window.location.href='experience.php';</script>";
        	exit;
        }
        else { 
        	$logincheck = 0;
		}
	}
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools login</title>
		<link rel="stylesheet" href="main.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="mainhead.css" content="text/html; charset=utf-8"/>
	</head>
	<body>
		<div class="container">
			<?php
				require('mainhead.php');
			?>
			<div class="column">
				<form action="login.php?action=check" method="post" class="form">
					<?php
						if ($logincheck == 0) {
							print '<div class="contentbox" style="margin-top: -24px;"> Sorry, that combination of username and password did not work, or your account is not active. Try again or see options below the login form.</div><br />';
						}
					?>
					<div class="fielddiv">
						<div class="fieldname">
							Username
						</div>
						<div class="fieldvalue">
							<input name="username" type="text" class="inputtext" maxlength="150" placeholder="enter username" required />
						</div>
					</div>
					<div class="fielddiv">
						<div class="fieldname">
							Password
						</div>
						<div class="fieldvalue">
							<input name="password" type="password" class="inputtext" maxlength="150" placeholder="enter password" required />
						</div>
					</div>
					<div class="fielddiv">
						<div class="fieldname">
							
						</div>
						<div class="fieldvalue">
							<input type="submit" name="submit" class="submitbutton" value="Log in" />
						</div>
					</div>
				</form>
				<!-- other links -->
				<div class="contentbox" style="margin-top: -6px;">
					<div class="fielddiv">
						<div class="fieldname">
							Need an account?
						</div>
						<div class="fieldvalue" style="padding-top: 8px;">
							<?php 
								$loc1 = "'profile.php?action=new'";
								print '<button class="button150" onclick="window.location.href='.$loc1.';">Set up account</button>';
							?>
						</div>
					</div>
					<div class="fielddiv">
						<div class="fieldname">
							Login not working?
						</div>
						<div class="fieldvalue" style="padding-top: 12px;">
							<a href="profile.php?action=help" class="textlink">Retrieve your username or reset password</a>
						</div>
					</div>
					<div class="fielddiv">
						<div class="fieldname">
							Need more help?
						</div>
						<div class="fieldvalue" style="padding-top: 12px;">
							<a href="support.php" class="textlink">Go to Support</a>
						</div>
					</div>
				</div>
			</div>
			<div class="column">
				<div class="contentbox">
					<div class="contentboxtitle">Welcome to Thinkertools</div><br />
					To use any platform, application, or tool you'll need an account. We require your real name and email to sign up. You'll be asked to create a username and a password.
					<br /><br />
					We don't require any other information. We don't sell or otherwise provide your information to any other entity.
					<br /><br />
					We won't contact you with your email unless you request support or modify your account. System updates and other messages come through the Thinkertools message dashboard.
					<br /><br />
					We don't create cookies. However, when you sign into your account you're logged into the Thinkertools world until you log out or close your browser.
					<br /><br />
					For more information on our policies, <a href="https://thinkertools.org/policies.html" class="textlink" target="_blank">go to our policies page</a>. <br /><br />
					Please let us know if you have any questions. Email us anytime: info@thinkertools.org
				</div>
			</div>
		</div>
	</body>
</html>
