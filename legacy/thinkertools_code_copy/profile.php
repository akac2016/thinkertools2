<?php session_start();
	// user account db
	require('accountsdb.php');
	// check activation
	$activate = 0;
	if (isset($_GET['code1']) && isset($_GET['code2']) && $_GET['action'] != "reset") {
		$hash = "#"; $hex = $hash . $_GET['code2']; 
		$getUser = "SELECT userID, teacher FROM ttuser WHERE userID =? AND fontcolor =?";
        $user = $mysqli->execute_query($getUser, [$_GET['code1'], $hex])->fetch_assoc();
    	$activate = 1;
    	// activate user
    	$stmt = $mysqli->prepare("UPDATE ttuser SET active=? WHERE userID=?");
		$stmt->bind_param('ii', $activate, $user['userID']);
		$stmt->execute();
		$stmt->close();
	}
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools profile</title>
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
				<div class="columnhead">
					<span class="columnheadtitle">
						<?php 
							if ($_GET['action'] == 'new' || $_GET['action'] == 'newcheck') print 'Create an account';
							elseif ($activate == 1) print 'Your account is activated';
							elseif ($_GET['action'] == "help" || $_GET['action'] == 'helpcheck' || $_GET['action'] == 'reset' || $_GET['action'] == 'resetcheck') print 'Account help';
							else {
								print 'Modify your profile';
							}
						 ?>
					</span>
				</div>
				<?php 
					if (!isset($_GET['action']) && $activate !=1) {
						print '
						<div class="contentbox blank">
							Go to <a href="profile.php?action=edit" class="textlink">modify your profile</a>.
						</div>';
					}
					if ($activate == 1) {
						print '<div class="columnhead" style="width: 400px; padding:22px; margin-bottom:24px;">
						<a href="login.php" class="toollink"><span style="color:#C63232; font-size:24px">Log in to get started</span></a>
						</div>';
					}
					// new account form
					if ($_GET['action'] == 'new') {
						print '
						<div class="contentbox blank">
						<form action="profile.php?action=newcheck" method="post"> 
						<div class="fielddiv">
							<div class="fieldname">
								First name
							</div>
							<div class="fieldvalue">
								<input name="firstname" type="text" class="inputtext" placeholder="first name (letters only)" required />
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Last name
							</div>
							<div class="fieldvalue">
								<input name="lastname" type="text" class="inputtext" placeholder="last name (letters only)" required />
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Teacher account?
							</div>
							<div class="fieldvalue">
								<input name="teacher" type="radio" value="0" checked /> no <input name="teacher" type="radio" value="1" /> yes
							</div> 
							<br />
							<div class="fieldvalue" style="margin-left:100px">
								<span style="color:gray">Reserved for classroom instruction, must have .EDU email or contact support</span>
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Email
							</div>
							<div class="fieldvalue">
								<input name="email" type="text" class="inputtext" placeholder="email" required />
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Confirm
							</div>
							<div class="fieldvalue">
								<input name="emailconfirm" type="text" class="inputtext" placeholder="confirm email" required />
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Username
							</div>
							<div class="fieldvalue">
								<input name="username" type="text" class="inputtext" placeholder="username 6-16 letters and numbers only" autocomplete="off" required />
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Password
							</div>
							<div class="fieldvalue">
								<input name="password" type="password" class="inputtext" placeholder="8-32 characters: upper/lower/number/special" autocomplete="new-password" required /><br />
								<span style="color:gray">A strong password is 8-32 characters, and at least<br />one of each: uppercase letter, lowercase letter, digit, <br /> and special character like @ # $ % & . , ? ! : ;</span>
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Confirm
							</div>
							<div class="fieldvalue">
								<input name="passwordconfirm" type="password" class="inputtext" placeholder="confirm password" required />
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Code
							</div>
							<div class="fieldvalue">
								<input name="code" type="text" class="inputtext" placeholder="new member code" required /><br />
								<span style="color:gray">New member code, enter: Thinker</span>
							</div>
						</div>
						<div class="fielddiv"">
							<div class="fieldname">
							
							</div>
							<div class="fieldvalue">
								<input type="submit" name="submit" class="submitbutton" value="Submit" />
							</div>
						</div>
				      	</form>  
				      	<br /><br>
				      	</div>';
					}
					// new account check
					elseif ($_GET['action'] == 'newcheck') {
						print '<div class="contentbox">
						<strong>New account - check</strong><br /><br />';
						$register_error = 0;
						// username check length, letters & numbers
						if (strlen($_POST['username']) > 16 || strlen($_POST['username']) < 6) {$register_error = $register_error + 1; print 'username length error <br />';}
						if (!ctype_alnum($_POST['username'])) {$register_error = $register_error + 1; print 'username requires letters and numbers only <br />';}
						// username check if unique
						$getUsername = "SELECT userID FROM ttuser WHERE username =?";
						$usernameCheck = $mysqli->execute_query($getUsername, [$_POST['username']])->fetch_assoc();
						if (!empty($usernameCheck)) {
							$register_error = $register_error + 1; print 'username is not unique <br />';
						}
						// first, last name check
						if (!ctype_alnum($_POST['firstname'])) {$register_error = $register_error + 1; print 'first name must be letters and numbers only <br />';}
						if (!ctype_alnum($_POST['lastname'])) {$register_error = $register_error + 1; print 'last name must be letters and numbers only <br /> ';}
						// email
						if ($_POST['email'] != $_POST['emailconfirm']) {$register_error = $register_error + 1; print 'email and confirm do not match <br />';}
						if (!filter_var($_POST['email'], FILTER_VALIDATE_EMAIL)) {$register_error = $register_error + 1; print 'email form error <br />';}
						$getEmail = "SELECT userID FROM ttuser WHERE email =?";
						$emailCheck = $mysqli->execute_query($getEmail, [$_POST['email']])->fetch_assoc();
						if (!empty($emailCheck)) {
							$register_error = $register_error + 1; print 'the email is already associated with an account <br />';
						}
						// .edu email check if teacher
						if ($_POST['teacher'] == 1) {
							$emailEDU = explode('.', $_POST['email']);
							if (array_pop($emailEDU) === 'edu' ) {print ' ';}
							else {
								$register_error = $register_error + 1; print 'teacher account must have a .EDU email, or contct support. <br />';
							}
						}
						// password
						$uppercase = preg_match('@[A-Z]@', $_POST['password']);
						$lowercase = preg_match('@[a-z]@', $_POST['password']);
						$number    = preg_match('@[0-9]@', $_POST['password']);
						$specialChars = preg_match('@[^\w]@', $_POST['password']);
						if (strlen($_POST['password']) < 8 || strlen($_POST['password']) > 32 || !$uppercase || !$lowercase || !$number || !$specialChars) {$register_error = $register_error + 1; print 'password length, and/or strength error <br />';}
						if ($_POST['password'] != $_POST['passwordconfirm']) {$register_error = $register_error + 1; print 'password confirm error <br />';} 
						// new member code
						if ($_POST['code'] != "Thinker") {$register_error = $register_error + 1; print 'new member code error <br />';}
						// insert new account
						if ($register_error == 0) {
							$startdate = date('Y-m-d H:i:s');
							// font color (random hex)
							$red = rand(0,255);
							$green = rand(0,255);
							$blue = rand(0,255);
							$fontcolor = sprintf("#%02x%02x%02x", $red, $green , $blue);
							//insert and mail
							$stmt = $mysqli->prepare("INSERT INTO ttuser (username, firstname, lastname, email, password, startdate, fontcolor, teacher) VALUES (?,?,?,?,?,?,?,?)");
							$stmt->bind_param("sssssssi", $_POST['username'], $_POST['firstname'], $_POST['lastname'], $_POST['email'], $_POST['password'], $startdate, $fontcolor, $_POST['teacher']);
							$stmt->execute();
							$stmt->close();
							sleep(1);
							// get userID and hex (less #)
							$getUser = "SELECT userID, fontcolor FROM ttuser WHERE username =? and startdate =?";
        					$user = $mysqli->execute_query($getUser, [$_POST['username'], $startdate])->fetch_assoc();
        					$hex = ltrim($user['fontcolor'], '#');
        					// teacher team
							if ($_POST['teacher'] == 1) {
								$teacherTeam = 121;
								$stmt = $mysqli->prepare("INSERT INTO ttteam_mem (teamID, userID) VALUES (?,?)");
								$stmt->bind_param("ii", $teacherTeam, $user['userID']);
								$stmt->execute();
								$stmt->close();
							}
							// email new user
							$to = "".$_POST['email']."";
							$subject = "Activate your Thinkertools account";
							$activatelink = "https://thinkertools.us/profile.php?code1=".$user['userID']."&code2=".$hex."";
							$message = "Hello ".$_POST['firstname']." ".$_POST['lastname'].". Your Thinkertools account is ready, but you need to activate it to log in. Please click this link to <a href=".$activatelink.">activate account</a>. <br /><br /> 
							If you have any questions, check out our Support page, or reply to this email. 
							If you did not create an account, please reply to this email and we will investigate.";
							$from = "admin@thinkertools.org";
							$headers = "MIME-Version: 1.0" . "\r\n";
							$headers .= "Content-type:text/html;charset=iso-8859-1" . "\r\n";
							$headers .= "From:" . $from . "\r\n";
							mail($to,$subject,$message,$headers);
							// account ready message
							print 'Thank you! Your Thinkertools account has been created but needs to be activated. A confirmation and account activation link has been sent to your email address. Please check your email to activate.<br />';
						}
						// error message
						else {
							print '<br />Please check the errors and go back to try again. <br /><br />
							If you need assistance, please check Support.';
						}
						print '</div>';
					}
					// edit 
					elseif ($_GET['action'] == 'edit') {
						$getUser = "SELECT username, firstname, lastname, email, password FROM ttuser WHERE userID =?";
        				$user = $mysqli->execute_query($getUser, [$_SESSION['userID']])->fetch_assoc();
						print '
						<div class="contentbox blank">
						<form action="profile.php?action=editcheck" method="post"> 
						<div class="fielddiv">
							<div class="fieldname">
								First name
							</div>
							<div class="fieldvalue">
								<input name="firstname" type="text" class="inputtext" value="'.$user['firstname'].'" placeholder="first name (letters only)" required />
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Last name
							</div>
							<div class="fieldvalue">
								<input name="lastname" type="text" class="inputtext" value="'.$user['lastname'].'" placeholder="last name (letters only)" required />
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Email
							</div>
							<div class="fieldvalue">
								<input name="email" type="text" class="inputtext" value="'.$user['email'].'" placeholder="email" required />
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Confirm
							</div>
							<div class="fieldvalue">
								<input name="emailconfirm" type="text" class="inputtext" value="'.$user['email'].'" placeholder="confirm email" required />
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Username
							</div>
							<div class="fieldvalue">
								<input name="username" type="text" class="inputtext" value="'.$user['username'].'" placeholder="username 6-16 letters and numbers only" required />
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Password
							</div>
							<div class="fieldvalue">
								<input name="password" type="password" class="inputtext" value="'.$user['password'].'" placeholder="8-32 characters: upper/lower/number/special" required /><br />
								A strong password is 8-32 characters, and at least<br />one of each: uppercase letter, lowercase letter, digit, <br /> and special character like @ # $ % & . , ? ! : ;
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Confirm
							</div>
							<div class="fieldvalue">
								<input name="passwordconfirm" type="password" class="inputtext" value="'.$user['password'].'" placeholder="confirm password" required />
							</div>
						</div>
						<div class="fielddiv"">
							<div class="fieldname">
							
							</div>
							<div class="fieldvalue">
								<input type="submit" name="submit" class="submitbutton" value="Submit" />
							</div>
						</div>
				      	</form>
				      	</div>';
					}
					// edit check
					elseif ($_GET['action'] == 'editcheck') {
						//get original username and email (for check if unique)
						$getUser = "SELECT username, email FROM ttuser WHERE userID =?";
        				$user = $mysqli->execute_query($getUser, [$_SESSION['userID']])->fetch_assoc();
						$currentusername = $user['username'];
						$currentemail = $user['email'];
						print '<div class="contentbox">
						<strong>Modify profile - check</strong><br /><br />';
						$register_error = 0;
						// username
						if ($currentusername != $_POST['username']) {
							if (strlen($_POST['username']) > 16 || strlen($_POST['username']) < 6) {$register_error = $register_error + 1; print 'username length error <br />';}
							if (!ctype_alnum($_POST['username'])) {$register_error = $register_error + 1; print 'username requires letters and numbers only <br />';}
							$getUsername = "SELECT userID FROM ttuser WHERE username =?";
							$usernameCheck = $mysqli->execute_query($getUsername, [$_POST['username']])->fetch_assoc();
							if (!empty($usernameCheck)) {
								$register_error = $register_error + 1; print 'username is not unique <br />';
							}
						}
						// first, last name
						if (!ctype_alnum($_POST['firstname'])) {$register_error = $register_error + 1; print 'first name must be letters and numbers only <br />';}
						if (!ctype_alnum($_POST['lastname'])) {$register_error = $register_error + 1; print 'last name must be letters and numbers only <br /> ';}
						// email
						if (!filter_var($_POST['email'], FILTER_VALIDATE_EMAIL)) {$register_error = $register_error + 1; print 'email form error <br />';}
						if (!filter_var($_POST['emailconfirm'], FILTER_VALIDATE_EMAIL)) {$register_error = $register_error + 1; print 'email confirm form error <br />';}
						if ($_POST['email'] != $_POST['emailconfirm']) {$register_error = $register_error + 1; print 'email and confirm not the same <br />';}
						if ($currentemail != $_POST['email']) {
							$getEmail = "SELECT userID FROM ttuser WHERE email =?";
							$emailCheck = $mysqli->execute_query($getEmail, [$_POST['email']])->fetch_assoc();
							if (!empty($emailCheck)) {
								$register_error = $register_error + 1; print 'the email is already associated with an account <br />';
							}
						}
						// password
						if ($_POST['password'] != $_POST['passwordconfirm']) {$register_error = $register_error + 1; print 'password confirm error <br />';}
						$uppercase = preg_match('@[A-Z]@', $_POST['password']);
						$lowercase = preg_match('@[a-z]@', $_POST['password']);
						$number    = preg_match('@[0-9]@', $_POST['password']);
						$specialChars = preg_match('@[^\w]@', $_POST['password']);
						if (strlen($_POST['password']) < 8 || strlen($_POST['password']) > 32 || !$uppercase || !$lowercase || !$number || !$specialChars) {$register_error = $register_error + 1; print 'password length, and/or strength error <br />';}
						// modified account
						if ($register_error == 0) {
							$stmt = $mysqli->prepare("UPDATE ttuser SET username=?, firstname=?, lastname=?, email=?, password=? WHERE userID=?");
							$stmt->bind_param('sssssi', $_POST['username'], $_POST['firstname'], $_POST['lastname'], $_POST['email'], $_POST['password'], $_SESSION['userID']);
							$stmt->execute();
							$stmt->close();
							// update session first name
							$_SESSION['firstname'] = $_POST['firstname'];
							// email user
							$to = "".$_POST['email']."";
							$subject = "Your Thinkertools account has been updated";
							$message = "Hello ".$_POST['firstname']." ".$_POST['lastname'].". Your Thinkertools account has been updated. <br /><br />If you did not modify your account, please reply to this email and we will investigate.";
							$from = "admin@thinkertools.org";
							$headers = "MIME-Version: 1.0" . "\r\n";
							$headers .= "Content-type:text/html;charset=iso-8859-1" . "\r\n";
							$headers .= "From:" . $from . "\r\n";
							mail($to,$subject,$message,$headers);
							// account ready message
							print 'Your Thinkertools account has been modified. A confirmation has been sent to your email address. Thank you!<br />';
						}
						// error message
						else {
							print '<br />Please go back to check the errors try again. <br /><br />
							If you need assistance, please check Support.';
						}
						print '</div>';
					}
					elseif ($_GET['action'] == 'help') {
						print '
						<div class="contentbox blank">
						To retrieve your username or reset your password, please enter the email associated with your account. <br /><br />
							<form action="profile.php?action=helpcheck" method="post"> 
							<div class="fielddiv">
								<div class="fieldname">
									Email
								</div>
								<div class="fieldvalue">
									<input name="email" type="text" class="inputtext" placeholder="email" required />
								</div>
							</div>
							<div class="fielddiv"">
								<div class="fieldname">
								
								</div>
								<div class="fieldvalue">
									<input type="submit" name="submit" class="submitbutton" value="Submit" />
								</div>
							</div>
					      	</form>
				      	</div>';
					}
					elseif ($_GET['action'] == 'helpcheck') {
						$getUser = "SELECT userID, username, firstname, lastname, fontcolor FROM ttuser WHERE email =?";
        				$user = $mysqli->execute_query($getUser, [$_POST['email']])->fetch_assoc();
        				if (empty($user)) { 
        					print '<br /><br />The email you entered is not associated with any account, please try again.';
        				}
        				else {
        					// email user
        					$code1 = $user['userID'];
        					$code2 = ltrim($user['fontcolor'], '#');
        					$activatelink = "https://thinkertools.us/profile.php?action=reset&code1=".$code1."&code2=".$code2."";
							$to = "".$_POST['email']."";
							$subject = "Thinkertools account help";
							$message = "Hello ".$user['firstname']." ".$user['lastname'].". You requested your username or to reset your password. If you didn't, please reply to this email and we will investigate.<br /><br />Your username is ".$user['username']."  <br /><br /> If you forgot your password, click this link to <a href=".$activatelink.">reset your password</a>.";
							$from = "admin@thinkertools.org";
							$headers = "MIME-Version: 1.0" . "\r\n";
							$headers .= "Content-type:text/html;charset=iso-8859-1" . "\r\n";
							$headers .= "From:" . $from . "\r\n";
							mail($to,$subject,$message,$headers);
							// account ready message
							print '<br /><br />Your Thinkertools account info was sent to your email address. We hope it helps.<br />';
        				} 
					}
					elseif ($_GET['action'] == 'reset') {
						print '
						<div class="contentbox blank">
							Enter a new password. <br /><br />
							<form action="profile.php?action=resetcheck" method="post"> 
							<div class="fielddiv">
								<div class="fieldname">
									Password
								</div>
								<div class="fieldvalue">
									<input name="password" type="password" class="inputtext" placeholder="8-32 characters: upper/lower/number/special" required /><br />
								A strong password is 8-32 characters, and at least<br />one of each: uppercase letter, lowercase letter, digit, <br /> and special character like @ # $ % & . , ? ! : ;
								</div>
							</div>
							<div class="fielddiv">
								<div class="fieldname">
									Confirm
								</div>
								<div class="fieldvalue">
									<input name="passwordconfirm" type="password" class="inputtext" placeholder="confirm password" required />
								</div>
							</div>
							<div class="fielddiv"">
								<div class="fieldname">
								
								</div>
								<div class="fieldvalue">
									<input type="submit" name="submit" class="submitbutton" value="Submit" />
								</div>
							</div>
							<br /><br />
							<input type="hidden" name="userID" value="'.$_GET['code1'].'" />
							<input type="hidden" name="hex" value="'.$_GET['code2'].'" />
					      	</form>
				      	</div>';
					}
					// reset check
					elseif ($_GET['action'] == 'resetcheck') {
						//get original username and email (for check if unique)
						$userID = $_POST['userID'];
						$hash = "#"; 
						$hex = $hash . $_POST['hex'];
						$getUser = "SELECT userID, firstname, lastname, email FROM ttuser WHERE userID=? && fontcolor =?";
        				$user = $mysqli->execute_query($getUser, [$userID, $hex])->fetch_assoc();
        				if (empty($user)) {
        					print '<br />Your password cannot be reset, please go to Support';
        				}
        				else {
        					print '<div class="contentbox blank">';
	        					// password
	        					$register_error = 0;
								if ($_POST['password'] != $_POST['passwordconfirm']) {$register_error = $register_error + 1; print 'password confirm error <br />';}
								$uppercase = preg_match('@[A-Z]@', $_POST['password']);
								$lowercase = preg_match('@[a-z]@', $_POST['password']);
								$number    = preg_match('@[0-9]@', $_POST['password']);
								$specialChars = preg_match('@[^\w]@', $_POST['password']);
								if (strlen($_POST['password']) < 8 || strlen($_POST['password']) > 32 || !$uppercase || !$lowercase || !$number || !$specialChars) {$register_error = $register_error + 1; print 'password length, and/or strength error <br />';}
								// modified account
								if ($register_error == 0) {
									// update 
									$stmt = $mysqli->prepare("UPDATE ttuser SET password=? WHERE userID=?");
									$stmt->bind_param('si', $_POST['password'], $userID);
									$stmt->execute();
									$stmt->close();
									// email
									$to = "".$user['email']."";
									$subject = "Your Thinkertools account has been updated";
									$message = "Hello ".$user['firstname']." ".$user['lastname'].". Your Thinkertools password has been reset.";
									$from = "admin@thinkertools.org";
									$headers = "MIME-Version: 1.0" . "\r\n";
									$headers .= "Content-type:text/html;charset=iso-8859-1" . "\r\n";
									$headers .= "From:" . $from . "\r\n";
									mail($to,$subject,$message,$headers);
									// reset message
									print 'Your Thinkertools password has been reset. A confirmation has been sent to your email address.<br />';
								}
        						else {
        							print '<br />Your password cannot be reset, please try again or check Support';
        						}
        					print '</div>';
        				}
        			}
				?>
			</div>
			<div class="column">
				<div class="columnhead red">
					<span class="columnheadtitle">Welcome to Thinkertools</span>
				</div>
				<div class="contentbox">
					<?php
					if (!isset($_SESSION['userID'])) {
						print '
						To use any platform, application, or tool you\'ll need an account. We require your real name and email to sign up. You\'ll be asked to create a username and a password.
						<br /><br />
						We don\'t require any other information. We don\'t sell or otherwise provide your information to any other entity.
						<br /><br />
						We won\'t contact you with your email unless you request support or modify your account. System updates and other messages come through the Thinkertools message dashboard.
						<br /><br />
						We don\'t create cookies. However, when you sign into your account you\'re logged into the Thinkertools world until you log out or close your browser.
						<br /><br />
						For more information on our policies, <a href="https://thinkertools.org/policies.html" class="textlink" target="_blank">go to our policies page</a>. <br /><br />
						Please let us know if you have any questions. Email us anytime: info@thinkertools.org';
					}
					else {
						print '
						Please let us know if you have any questions about your account profile: admin@thinkertools.org';
					}
					?>
				</div>
			</div>
		</div>
	</body>
</html>
