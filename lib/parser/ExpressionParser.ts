///<reference path='../imports.d.ts'/>

// http://docs.python.org/reference/expressions.html#summary
// https://developer.mozilla.org/en/JavaScript/Reference/Operators/Operator_Precedence

export import ParserNode = module('./ParserNode');
export import TokenReader = module('../lexer/TokenReader');

export class ExpressionParser {
	constructor(public tokenReader: TokenReader.TokenReader) {
	}

	parseCommaExpression(): ParserNode.ParserNodeCommaExpression {
		var expressions: ParserNode.ParserNodeExpression[] = [];
		while (true) {
			expressions.push(this.parseExpression());
			if (this.tokenReader.peek().value != ',') break;
			this.tokenReader.skip();
		}
		return new ParserNode.ParserNodeCommaExpression(expressions);
	}

	parseExpression(): ParserNode.ParserNodeExpression {
		return this.parseFunctionCall();
	}

	parseFunctionCall() {
		var expr = this.parseTernary();

		while (true) {
			// Function call
			if (this.tokenReader.peek().value == '(')
			{
				this.tokenReader.skip();
				var arguments;
				if (this.tokenReader.peek().value != ')') {
					arguments = this.parseCommaExpression();
				} else {
					arguments = new ParserNode.ParserNodeCommaExpression([]);
				}
				this.tokenReader.expectAndMoveNext(')');
				if (expr instanceof ParserNode.ParserNodeIdentifier) {
					expr = new ParserNode.ParserNodeFunctionCall(new ParserNode.ParserNodeLiteral(expr.value), arguments);
				} else {
					expr = new ParserNode.ParserNodeFunctionCall(expr, arguments);
				}
			}
			// Filter
			else if (this.tokenReader.peek().value == '|')
			{
				this.tokenReader.skip();
				var filterName = this.tokenReader.peek().value;
				this.tokenReader.skip();

				var arguments = new ParserNode.ParserNodeCommaExpression([]);

				if (this.tokenReader.peek().value == '(') {
					this.tokenReader.skip();
					if (this.tokenReader.peek().value != ')') {
						arguments = this.parseCommaExpression();
					}
					this.tokenReader.expectAndMoveNext(')');
				}

				arguments.expressions.unshift(expr);

				expr = new ParserNode.ParserNodeFilterCall(filterName, arguments);
			}
			// End or other
			else
			{
				return expr;
			}
		}
	}

	parseTernary() {
		var left = this.parseLogicOr();
		if (this.tokenReader.peek().value == '?') {
			this.tokenReader.skip();
			var middle = this.parseExpression();
			this.tokenReader.expectAndMoveNext(':');
			var right = this.parseExpression();

			left = new ParserNode.ParserNodeTernaryOperation(left, middle, right);
		}
		return left;
	}

	parseLogicOr() {
		return this._parseBinary('parseLogicOr', this.parseLogicAnd, ['||', 'or']);
	}

	parseLogicAnd() {
		return this._parseBinary('parseLogicAnd', this.parseCompare, ['&&', 'and']);
	}

	//parseBitOr() {
	//	return this._parseBinary('parseBitOr', this.parseBitXor, ['or']);
	//}
	//
	//parseBitXor() {
	//	return this._parseBinary('parseBitXor', this.parseBitAnd, ['^']);
	//}
	//
	//parseBitAnd() {
	//	return this._parseBinary('parseBitAnd', this.parseCompare, ['&']);
	//}

	parseCompare() {
		return this._parseBinary('parseCompare', this.parseAddSub, ['==', '!=', '>=', '<=', '>', '<', '===', '!==']);
	}

	parseAddSub() {
		return this._parseBinary('parseAddSub', this.parseMulDiv, ['+', '-']);
	}

	parseMulDiv() {
		return this._parseBinary('parseMulDiv', this.parseLiteralUnary, ['*', '/', '%']);
	};

	parseLiteralUnary() {
		var token = this.tokenReader.peek();
	
		// '(' <expression> ')'
		if (this.tokenReader.checkAndMoveNext('(')) {
			var subExpression = this.parseExpression();
			this.tokenReader.expectAndMoveNext(')');
			return subExpression;
		}

		// '[' [<expression> [',']] ']'
		if (this.tokenReader.checkAndMoveNext('[')) {
			var elements: ParserNode.ParserNodeExpression[] = [];
			while (true) {
				if (this.tokenReader.peek().value == ']') {
					this.tokenReader.skip();
					break;
				}
				elements.push(this.parseExpression());
				if (this.tokenReader.peek().value == ']') {
					this.tokenReader.skip();
					break;
				} else if (this.tokenReader.peek().value == ',') {
					this.tokenReader.skip();
				}
			}
			return new ParserNode.ParserNodeArrayContainer(elements);
		}

		// Unary operator.
		if (['-', '+', '~', '!'].indexOf(token.value) != -1) {
			this.tokenReader.skip();
			return new ParserNode.ParserNodeUnaryOperation(token.value, this.parseLiteralUnary());
		}
	
		// Numeric literal.
		if (token.type == 'number') {
			this.tokenReader.skip();
			return new ParserNode.ParserNodeLiteral(token.value);
		}
	
		return this.parseIdentifier();
	};

	parseIdentifier(): ParserNode.ParserNodeExpression {
		var token = this.tokenReader.peek();

		if (token.type == 'id') {
			this.tokenReader.skip();
			var identifierString = token.value;

			switch (identifierString) {
				case 'false': return new ParserNode.ParserNodeLiteral(false);
				case 'true': return new ParserNode.ParserNodeLiteral(true);
				case 'null': return new ParserNode.ParserNodeLiteral(null);
				default: return new ParserNode.ParserNodeIdentifier(identifierString);
			}
		}
	
		throw(new Error("Unexpected token : " + JSON.stringify(token.value)));
	};


	_parseBinary(levelName, nextParseLevel, validOperators) {
		var leftNode = nextParseLevel.apply(this);
		var rightNode;
		var currentOperator;

		while (this.tokenReader.hasMore) {
			if (validOperators.indexOf(this.tokenReader.peek().value) != -1) {
				currentOperator = this.tokenReader.peek().value;
				this.tokenReader.skip();
			} else {
				break;
			}

			rightNode = nextParseLevel.apply(this);
			leftNode = new ParserNode.ParserNodeBinaryOperation(currentOperator, leftNode, rightNode);
		}

		return leftNode;
	}
}