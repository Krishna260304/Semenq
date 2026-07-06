
from __future__ import annotations


class SemenqBaseException(Exception):

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"
    message: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None, details: object = None) -> None:
        self.message = message or self.__class__.message
        self.details = details
        super().__init__(self.message)



class AuthenticationException(SemenqBaseException):
    status_code = 401
    error_code = "AUTHENTICATION_FAILED"
    message = "Authentication failed."


class InvalidTokenException(SemenqBaseException):
    status_code = 401
    error_code = "INVALID_TOKEN"
    message = "Token is invalid or expired."


class TokenExpiredException(SemenqBaseException):
    status_code = 401
    error_code = "TOKEN_EXPIRED"
    message = "Token has expired."


class AuthorizationException(SemenqBaseException):
    status_code = 403
    error_code = "AUTHORIZATION_FAILED"
    message = "You do not have permission to perform this action."


class AccountLockedException(SemenqBaseException):
    status_code = 423
    error_code = "ACCOUNT_LOCKED"
    message = "Account is temporarily locked due to multiple failed login attempts."


class EmailNotVerifiedException(SemenqBaseException):
    status_code = 403
    error_code = "EMAIL_NOT_VERIFIED"
    message = "Please verify your email address before continuing."


class PhoneNotVerifiedException(SemenqBaseException):
    status_code = 403
    error_code = "PHONE_NOT_VERIFIED"
    message = "Please verify your phone number before continuing."



class DuplicateUserException(SemenqBaseException):
    status_code = 409
    error_code = "DUPLICATE_USER"
    message = "A user with this information already exists."


class UserNotFoundException(SemenqBaseException):
    status_code = 404
    error_code = "USER_NOT_FOUND"
    message = "User not found."


class InvalidCredentialsException(SemenqBaseException):
    status_code = 401
    error_code = "INVALID_CREDENTIALS"
    message = "Invalid email/phone or password."


class WeakPasswordException(SemenqBaseException):
    status_code = 422
    error_code = "WEAK_PASSWORD"
    message = "Password does not meet security requirements."



class ValidationException(SemenqBaseException):
    status_code = 422
    error_code = "VALIDATION_ERROR"
    message = "Request validation failed."


class InvalidFileException(SemenqBaseException):
    status_code = 422
    error_code = "INVALID_FILE"
    message = "The uploaded file is invalid or unsupported."


class FileTooLargeException(SemenqBaseException):
    status_code = 413
    error_code = "FILE_TOO_LARGE"
    message = "Uploaded file exceeds the maximum allowed size."



class BusinessException(SemenqBaseException):
    status_code = 400
    error_code = "BUSINESS_ERROR"
    message = "A business rule violation occurred."


class NotFoundException(SemenqBaseException):
    status_code = 404
    error_code = "NOT_FOUND"
    message = "The requested resource was not found."


class ConflictException(SemenqBaseException):
    status_code = 409
    error_code = "CONFLICT"
    message = "A conflict occurred with existing data."



class MedicineNotFoundException(SemenqBaseException):
    status_code = 404
    error_code = "MEDICINE_NOT_FOUND"
    message = "Medicine not found."


class InsufficientStockException(SemenqBaseException):
    status_code = 409
    error_code = "INSUFFICIENT_STOCK"
    message = "Insufficient stock available for this reservation."


class ExpiredMedicineException(SemenqBaseException):
    status_code = 422
    error_code = "EXPIRED_MEDICINE"
    message = "Medicine batch has expired and cannot be reserved."


class DuplicateBatchException(SemenqBaseException):
    status_code = 409
    error_code = "DUPLICATE_BATCH"
    message = "A batch with this number already exists."



class ReservationNotFoundException(SemenqBaseException):
    status_code = 404
    error_code = "RESERVATION_NOT_FOUND"
    message = "Reservation not found."


class ReservationExpiredException(SemenqBaseException):
    status_code = 410
    error_code = "RESERVATION_EXPIRED"
    message = "This reservation has expired."


class InvalidReservationStateException(SemenqBaseException):
    status_code = 422
    error_code = "INVALID_RESERVATION_STATE"
    message = "This action is not allowed in the current reservation state."


class PaymentVerificationException(SemenqBaseException):
    status_code = 400
    error_code = "PAYMENT_VERIFICATION_FAILED"
    message = "Payment signature verification failed."


class PaymentFailedException(SemenqBaseException):
    status_code = 400
    error_code = "PAYMENT_FAILED"
    message = "Payment processing failed."


class InvalidPaymentStateException(SemenqBaseException):
    status_code = 422
    error_code = "INVALID_PAYMENT_STATE"
    message = "This action is not allowed in the current payment state."


class DuplicatePaymentException(SemenqBaseException):
    status_code = 409
    error_code = "DUPLICATE_PAYMENT"
    message = "This payment has already been processed."


class QRExpiredException(SemenqBaseException):
    status_code = 410
    error_code = "QR_EXPIRED"
    message = "QR code has expired."


class QRInvalidException(SemenqBaseException):
    status_code = 422
    error_code = "QR_INVALID"
    message = "QR code signature is invalid."


class QRAlreadyUsedException(SemenqBaseException):
    status_code = 409
    error_code = "QR_ALREADY_USED"
    message = "QR code has already been used for pickup."



class ProviderException(SemenqBaseException):
    status_code = 502
    error_code = "PROVIDER_ERROR"
    message = "External service provider returned an error."


class OCRException(SemenqBaseException):
    status_code = 502
    error_code = "OCR_FAILED"
    message = "OCR processing failed."


class AIException(SemenqBaseException):
    status_code = 502
    error_code = "AI_FAILED"
    message = "AI processing failed."


class StorageException(SemenqBaseException):
    status_code = 502
    error_code = "STORAGE_ERROR"
    message = "File storage operation failed."


class MapsException(SemenqBaseException):
    status_code = 502
    error_code = "MAPS_ERROR"
    message = "Maps provider returned an error."


class CourierException(SemenqBaseException):
    status_code = 502
    error_code = "COURIER_ERROR"
    message = "Courier provider returned an error."



class DatabaseException(SemenqBaseException):
    status_code = 503
    error_code = "DATABASE_ERROR"
    message = "A database error occurred."


class ConcurrencyException(SemenqBaseException):
    status_code = 409
    error_code = "CONCURRENCY_ERROR"
    message = "Data was modified concurrently. Please retry."



class RateLimitException(SemenqBaseException):
    status_code = 429
    error_code = "RATE_LIMITED"
    message = "Too many requests. Please slow down."


class PrescriptionNotFoundException(SemenqBaseException):
    status_code = 404
    error_code = "PRESCRIPTION_NOT_FOUND"
    message = "Prescription not found."


class PrescriptionProcessingException(SemenqBaseException):
    status_code = 500
    error_code = "PRESCRIPTION_PROCESSING_FAILED"
    message = "Failed to process prescription."


class OrderNotFoundException(SemenqBaseException):
    status_code = 404
    error_code = "ORDER_NOT_FOUND"
    message = "Order not found."
