from app.schemas.models import CandidateOutput, InputPack


def normalize_quote_text(value: str) -> str:
    return "".join(value.split()).strip("。！？!?,，；;：:\"'“”‘’")


def quote_matches_answer(quote: str, student_answer: str) -> bool:
    if not quote.strip():
        return False
    if quote in student_answer:
        return True
    normalized_quote = normalize_quote_text(quote)
    normalized_answer = normalize_quote_text(student_answer)
    return bool(normalized_quote) and normalized_quote in normalized_answer


def valid_student_quotes(input_pack: InputPack, candidate_output: CandidateOutput) -> list[str]:
    quotes: list[str] = []
    for candidate in candidate_output.candidate_explanations:
        for quote in candidate.student_quotes:
            if quote_matches_answer(quote, input_pack.student_answer):
                quotes.append(quote)
    return quotes


def quote_exists(input_pack: InputPack, candidate_output: CandidateOutput) -> bool:
    return bool(valid_student_quotes(input_pack, candidate_output))
